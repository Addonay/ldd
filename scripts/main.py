# import polars as pl

# df = pl.read_excel("C:/Users/23225959/dev/ldd/static/reports/KE_QoS_Report_20260212.xlsx", sheet_name="KE")
# print(df.head())
# df.write_csv("C:/Users/23225959/dev/ldd/static/reports/KE_QoS_Report_20260212.csv")

if __name__ == "__main__":
    from pathlib import Path
    import shutil

    latest = max(Path("C:/Users/23225959/dev/ldd/static/reports/generated").glob("KE_QoS_Report_*.xlsx"), key=lambda p: p.stat().st_mtime)
    # print()
    # shutil.copy(latest, Path(f"C:/Users/23225959/OneDrive - Airtel Africa/daily_qos_reports/KE_QoS_Report_{latest.stem.split('_')[3]}.xlsx"))
    shutil.copy("C:/Users/23225959/dev/charting-qos/main.ipynb", Path("C:/Users/23225959/dev/ldd/scripts/main.ipynb"))