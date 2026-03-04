from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import xlsxwriter


@dataclass
class Threshold:
	operator: str
	value: float


def _to_datetime(value: Any) -> datetime | None:
	if isinstance(value, datetime):
		return value
	if isinstance(value, str):
		text = value.strip()
		if not text:
			return None
		text = text.replace("Z", "+00:00")
		try:
			parsed = datetime.fromisoformat(text)
			if parsed.tzinfo is not None:
				return parsed.replace(tzinfo=None)
			return parsed
		except ValueError:
			return None
	return None


def _to_float(value: Any) -> float | None:
	if value is None:
		return None
	try:
		return float(value)
	except (TypeError, ValueError):
		return None


def _meets(operator: str, actual: float, target: float) -> bool:
	if operator == ">=":
		return actual >= target
	if operator == "<=":
		return actual <= target
	if operator == ">":
		return actual > target
	if operator == "<":
		return actual < target
	if operator == "==":
		return abs(actual - target) < 1e-9
	if operator == "!=":
		return abs(actual - target) >= 1e-9
	return True


def _latest_numeric_value(points: list[dict[str, Any]]) -> float | None:
	best_date: datetime | None = None
	best_value: float | None = None
	for point in points:
		date = _to_datetime(point.get("date"))
		value = _to_float(point.get("value"))
		if date is None or value is None:
			continue
		if best_date is None or date > best_date:
			best_date = date
			best_value = value
	return best_value


def _sorted_points(points: list[dict[str, Any]]) -> list[tuple[datetime, float]]:
	parsed: list[tuple[datetime, float]] = []
	for point in points:
		date = _to_datetime(point.get("date"))
		value = _to_float(point.get("value"))
		if date is None or value is None:
			continue
		date = datetime(date.year, date.month, date.day)
		parsed.append((date, value))
	parsed.sort(key=lambda item: item[0])
	return parsed


def _build_thresholds(raw: dict[str, Any]) -> dict[str, Threshold]:
	out: dict[str, Threshold] = {}
	for name, item in raw.items():
		if not isinstance(item, dict):
			continue
		op = str(item.get("operator", "")).strip()
		val = _to_float(item.get("value"))
		if op and val is not None:
			out[name] = Threshold(operator=op, value=val)
	return out


def _format_threshold_value(value: float) -> str:
	if abs(value - round(value)) < 1e-9:
		return str(int(round(value)))
	return f"{value:.4f}".rstrip("0").rstrip(".")


def _calc_y_bounds(points: list[tuple[datetime, float]], threshold_value: float) -> tuple[float, float]:
	values = [value for _, value in points]
	values.append(threshold_value)
	min_v = min(values)
	max_v = max(values)
	span = max_v - min_v
	padding = (span * 0.15) if span > 0 else max(abs(max_v) * 0.1, 1.0)
	return min_v - padding, max_v + padding


def generate(payload: dict[str, Any], output_path: Path, source_path: Path | None = None) -> dict[str, Any]:
	thresholds = _build_thresholds(payload.get("thresholds", {}))
	areas: list[dict[str, Any]] = payload.get("areas", [])
	output_path.parent.mkdir(parents=True, exist_ok=True)

	workbook = xlsxwriter.Workbook(str(output_path))
	charts_ws = workbook.add_worksheet("Charts")
	data_ws = workbook.add_worksheet("_ChartData")
	# data_ws.hide()

	region_title_fmt = workbook.add_format(
		{
			"bold": True,
			"font_size": 16,
			"align": "center",
			"valign": "vcenter",
			"font_color": "#111111",
		}
	)
	data_header_fmt = workbook.add_format({"bold": True, "bg_color": "#F3F4F6", "border": 1})
	date_fmt = workbook.add_format({"num_format": "yyyy-mm-dd"})
	value_fmt = workbook.add_format({"num_format": "0.0000"})

	for col in range(24):
		charts_ws.set_column(col, col, 11)

	charts_ws.freeze_panes(2, 0)

	CHART_START_COLS = [0, 8, 16]
	CHARTS_PER_ROW = 3
	ROW_HEIGHT_BLOCK = 14
	CHART_WIDTH_PX = 640
	CHART_HEIGHT_PX = 300
	X_AXIS_LABEL_ROTATION = -90

	chart_count = 0
	region_count = 0
	chart_data_row = 0
	row_cursor = 0

	for area in areas:
		area_name = str(area.get("name", "")).strip() or "Unknown Area"
		kpis: list[dict[str, Any]] = area.get("kpis", [])

		failing: list[tuple[str, Threshold, list[tuple[datetime, float]]]] = []
		for kpi in kpis:
			kpi_name = str(kpi.get("name", "")).strip()
			if not kpi_name:
				continue
			threshold = thresholds.get(kpi_name)
			if threshold is None:
				continue

			raw_points: list[dict[str, Any]] = kpi.get("values", [])
			latest = _latest_numeric_value(raw_points)
			if latest is None:
				continue
			if _meets(threshold.operator, latest, threshold.value):
				continue

			points = _sorted_points(raw_points)
			if points:
				failing.append((kpi_name, threshold, points))

		if not failing:
			continue

		region_count += 1
		charts_ws.set_row(row_cursor, 26)
		charts_ws.set_row(row_cursor + 1, 18)
		charts_ws.merge_range(row_cursor, 0, row_cursor + 1, 23, area_name.upper(), region_title_fmt)

		grid_start_row = row_cursor + 3

		for index, (kpi_name, threshold, points) in enumerate(failing):
			data_start_row = chart_data_row
			data_ws.write(data_start_row, 0, "Date", data_header_fmt)
			data_ws.write(data_start_row, 1, kpi_name, data_header_fmt)
			data_ws.write(data_start_row, 2, "Threshold", data_header_fmt)

			for offset, (date_value, metric_value) in enumerate(points, start=1):
				data_ws.write_datetime(data_start_row + offset, 0, date_value, date_fmt)
				data_ws.write_number(data_start_row + offset, 1, metric_value, value_fmt)
				data_ws.write_number(data_start_row + offset, 2, threshold.value, value_fmt)

			data_end_row = data_start_row + len(points)
			chart_data_row = data_end_row + 2

			y_min, y_max = _calc_y_bounds(points, threshold.value)
			chart_title = f"{kpi_name} {threshold.operator} {_format_threshold_value(threshold.value)}"

			chart = workbook.add_chart({"type": "line"})
			chart.add_series(
				{
					"name": ["_ChartData", data_start_row, 1],
					"categories": ["_ChartData", data_start_row + 1, 0, data_end_row, 0],
					"values": ["_ChartData", data_start_row + 1, 1, data_end_row, 1],
					"line": {"color": "#FF6B5C", "width": 2.25},
					"marker": {"type": "none"},
					"smooth": True,
				}
			)
			chart.add_series(
				{
					"name": ["_ChartData", data_start_row, 2],
					"categories": ["_ChartData", data_start_row + 1, 0, data_end_row, 0],
					"values": ["_ChartData", data_start_row + 1, 2, data_end_row, 2],
					"line": {"color": "#2563EB", "width": 1.5, "dash_type": "round_dot"},
					"marker": {"type": "none"},
					"smooth": False,
				}
			)

			chart.set_title(
				{
					"name": chart_title,
					"name_font": {"bold": True, "size": 10, "name": "Calibri"},
				}
			)
			chart.set_legend({"none": True})
			chart.set_x_axis(
				{
					"name": "Date",
					"date_axis": True,
					"num_format": "mmm d",
					"num_font": {"name": "Calibri", "size": 9, "rotation": X_AXIS_LABEL_ROTATION},
					"major_unit": 1,
					"major_unit_type": "days",
					"minor_unit": 1,
					"minor_unit_type": "days",
					"interval_unit": 1,
					"position_axis": "on_tick",
					"major_tick_mark": "outside",
					"label_position": "low",
					"line": {"color": "#9CA3AF"},
					"major_gridlines": {"visible": True, "line": {"color": "#E5E7EB", "width": 0.75}},
					"min": points[0][0],
					"max": points[-1][0],
				}
			)
			chart.set_y_axis(
				{
					"name": "Value",
					"num_format": "0.0000",
					"major_tick_mark": "outside",
					"label_position": "next_to",
					"line": {"color": "#9CA3AF"},
					"major_gridlines": {"visible": True, "line": {"color": "#E5E7EB", "width": 0.75}},
					"min": y_min,
					"max": y_max,
				}
			)
			chart.set_plotarea({"border": {"none": True}})
			chart.set_chartarea({"border": {"none": True}})
			chart.set_size({"width": CHART_WIDTH_PX, "height": CHART_HEIGHT_PX})

			grid_row = index // CHARTS_PER_ROW
			grid_col = index % CHARTS_PER_ROW
			anchor_row = grid_start_row + (grid_row * ROW_HEIGHT_BLOCK)
			anchor_col = CHART_START_COLS[grid_col]
			charts_ws.insert_chart(anchor_row, anchor_col, chart, {"x_offset": 4, "y_offset": 2})
			chart_count += 1

		rows_used = ((len(failing) - 1) // CHARTS_PER_ROW + 1) * ROW_HEIGHT_BLOCK
		for row in range(grid_start_row, grid_start_row + rows_used):
			charts_ws.set_row(row, 18)
		row_cursor = grid_start_row + rows_used + 2

	workbook.close()

	return {
		"output_path": str(output_path),
		"regions_with_failures": region_count,
		"charts_created": chart_count,
		"source_template_used": bool(source_path and source_path.exists()),
	}


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("--input-json", required=True)
	parser.add_argument("--output", required=True)
	parser.add_argument("--source", required=False)
	args = parser.parse_args()

	input_path = Path(args.input_json)
	output_path = Path(args.output)
	source_path = Path(args.source) if args.source else None

	payload = json.loads(input_path.read_text(encoding="utf-8-sig"))
	result = generate(payload, output_path=output_path, source_path=source_path)
	print(json.dumps(result))


if __name__ == "__main__":
	main()
