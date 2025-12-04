
# elevenlabs_filter_FIXED.py
import pandas as pd
import re
from datetime import datetime

RAW_FILE    = "Raw Test.csv"
OUTPUT_FILE = "Filtered For 11Labs.csv"

def clean_phone(phone_str):
    if not phone_str or pd.isna(phone_str):
        return ""
    digits = re.findall(r'[0-9]{10,11}', str(phone_str).replace('-','').replace('(','').replace(')','').replace(' ',''))
    if not digits:
        return ""
    last = digits[-1]
    if len(last) == 11 and last.startswith('1'):
        return last
    if len(last) == 10:
        return '1' + last
    return '1' + last[-10:]

# 1–5 header rows are junk
df = pd.read_csv(RAW_FILE, skiprows=5, header=None)

df.columns = ["Customer","Vehicle","VIN","Mileage","Appointment_Date","Rate","PL","Purchase_Date",
              "Bank_Name","Payment","Sales_Person","Phone_Numbers","Service_Advisor"]

# 2 Delete rows with no vehicle
df = df.dropna(subset=["Vehicle"])
df = df[df["Vehicle"].str.strip() != ""]

# 3 Delete 2025 & 2026 models
df = df[~df["Vehicle"].str.contains(r"\b202[56]\b", na=False)]

# 4 Delete vehicles purchased < 12 months ago — COMMENT THIS LINE IF YOU WANT TO TEST FIRST
today = datetime.today()
def months_old(date_str):
    if not date_str or pd.isna(date_str): return 999
    try:
        d = pd.to_datetime(date_str, errors='coerce')
        if pd.isna(d): return 999
        months = (today.year - d.year)*12 + today.month - d.month
        if months < 0: months += 12
        return months
    except:
        return 999

df = df[df["Purchase_Date"].apply(months_old) >= 12]    # ← comment this line to disable age filter

# 5 Split name
names = df["Customer"].str.strip().str.split(n=1, expand=True)
df["First"] = names[0].str.title()
df["Last"]  = names[1].str.title() if names.shape[1] > 1 else ""

# 6 Year (2-digit), Model, Miles
df["Year2"] = df["Vehicle"].str.extract(r"\b(20\d{2})\b")[0].str[2:]
df["Model"] = df["Vehicle"].str.replace(r"\b20\d{2}\s+", " ", regex=True).str.strip()
df["Miles"] = pd.to_numeric(df["Mileage"], errors='coerce').fillna(0).astype(int)

# 7 Phone
df["Phone"] = df["Phone_Numbers"].apply(clean_phone)

# Final table
result = df[["First","Last","Year2","Model","Miles","Appointment_Date","Phone"]].copy()
result.insert(0, "Tag", "Future Service Appointment")
result.columns = ["Tag","Customer","Last_Name","Year","Vehicle","Miles","Appointment","Phone_Number"]

# Sort exactly like your example
result = result.sort_values(by=["Year","Appointment"], ascending=[False, True]).reset_index(drop=True)

result.to_csv(OUTPUT_FILE, index=False)
print(f"Done! {len(result)} rows → {OUTPUT_FILE}")
