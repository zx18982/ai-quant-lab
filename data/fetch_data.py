#!/usr/bin/env python3
"""Fetch kline data for 5 stocks via westock-data CLI and save as JSON."""

import json
import subprocess
import os

NODE = "/Users/zhangxiao/.workbuddy/binaries/node/versions/22.22.2/bin/node"
SCRIPT = "/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js"
DATA_DIR = os.path.dirname(os.path.abspath(__file__))

STOCKS = [
    {"code": "hk00981", "name": "中芯国际", "market": "HK", "currency": "HKD", "group": "中芯国际"},
    {"code": "sh688981", "name": "中芯国际", "market": "A", "currency": "CNY", "group": "中芯国际"},
    {"code": "sz002594", "name": "比亚迪", "market": "A", "currency": "CNY", "group": "比亚迪"},
    {"code": "hk01211", "name": "比亚迪股份", "market": "HK", "currency": "HKD", "group": "比亚迪"},
    {"code": "sh600900", "name": "长江电力", "market": "A", "currency": "CNY", "group": "长江电力"},
]


def fetch_kline(code):
    """Call westock-data kline and return parsed data (ascending by date)."""
    result = subprocess.run(
        [NODE, SCRIPT, "kline", code, "--period", "day", "--fq", "qfq", "--limit", "250"],
        capture_output=True, text=True, timeout=30
    )
    output = result.stdout.strip()
    if not output:
        print(f"  ERROR: No output for {code}")
        return []

    lines = output.split("\n")
    data = []
    header = None

    for line in lines:
        line = line.strip()
        if not line or not line.startswith("|"):
            continue

        # Split by | and strip whitespace
        parts = [p.strip() for p in line.split("|")]
        # Remove empty first/last elements from leading/trailing |
        parts = [p for p in parts if p != ""]

        if not parts:
            continue

        # Skip separator line (| --- | --- | ...)
        if all(p.startswith("-") for p in parts):
            continue

        # Header line
        if parts[0] == "date":
            header = parts
            continue

        # Data line
        if header and len(parts) >= 6:
            try:
                record = {"date": parts[0]}
                # Map fields by header position
                for i, col_name in enumerate(header):
                    if i == 0 or i >= len(parts):
                        continue
                    val = parts[i]
                    if col_name == "open":
                        record["open"] = float(val)
                    elif col_name == "last":
                        record["close"] = float(val)
                    elif col_name == "high":
                        record["high"] = float(val)
                    elif col_name == "low":
                        record["low"] = float(val)
                    elif col_name == "volume":
                        record["volume"] = int(float(val))
                    elif col_name == "amount":
                        try:
                            record["amount"] = float(val)
                        except ValueError:
                            pass

                if "close" in record:
                    data.append(record)
            except (ValueError, IndexError) as e:
                print(f"  Parse error: {e} on line: {line}")
                continue

    # Reverse to ascending order (oldest first)
    data.reverse()
    return data


def main():
    stocks_config = []
    for stock in STOCKS:
        code = stock["code"]
        print(f"Fetching {stock['name']} ({code})...")
        data = fetch_kline(code)
        print(f"  Got {len(data)} records")

        if not data:
            print(f"  WARNING: No data for {code}, skipping")
            continue

        # Save individual stock data
        filepath = os.path.join(DATA_DIR, f"{code}_daily.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  Saved to {filepath}")

        # Add to stocks config
        stock_entry = {
            "code": code,
            "name": stock["name"],
            "market": stock["market"],
            "currency": stock["currency"],
            "group": stock["group"],
            "data_file": f"{code}_daily.json",
            "data_count": len(data),
            "first_date": data[0]["date"] if data else None,
            "last_date": data[-1]["date"] if data else None,
            "last_close": data[-1]["close"] if data else None,
        }
        stocks_config.append(stock_entry)

    # Save stocks config
    config_path = os.path.join(DATA_DIR, "stocks.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump({"stocks": stocks_config}, f, ensure_ascii=False, indent=2)
    print(f"\nStocks config saved to {config_path}")
    print(f"Total stocks: {len(stocks_config)}")


if __name__ == "__main__":
    main()
