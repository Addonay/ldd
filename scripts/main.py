import polars as pl

df = pl.read_excel("C:/Users/23225959/dev/ldd/static/reports/KE_QoS_Report_20260212.xlsx", sheet_name="KE")
print(df.head())
df.write_csv("C:/Users/23225959/dev/ldd/static/reports/KE_QoS_Report_20260212.csv")
