#!/usr/bin/env python3
"""获取 300433 蓝思科技 最近两年前复权日线，并写入 web_tool/data/sz300433_daily.json。

依赖：node + westock-data 脚本（通过 subprocess 调用）。
数据列：date, open, last(=close), high, low, volume, amount, exchange
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "web_tool", "data")
NODE = "/Users/zhangxiao/.workbuddy/binaries/node/versions/22.22.2/bin/node"
WESTOCK = "/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js"

START = "2024-07-24"
END = "2026-07-24"
CODE = "sz300433"
NAME = "蓝思科技"


def fetch_kline(code, start, end):
    cmd = [NODE, WESTOCK, "kline", code, "--start", start, "--end", end, "--fq", "qfq", "--period", "day"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        raise RuntimeError("westock kline failed: " + out.stderr)
    return out.stdout


def parse_md_table(text):
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        if set(line) <= set("|- "):  # 分隔行
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if cells and cells[0] == "date":  # 表头
            continue
        rows.append(cells)
    return rows


def main():
    print(f"拉取 {CODE} {NAME} {START} ~ {END} ...")
    text = fetch_kline(CODE, START, END)
    rows = parse_md_table(text)
    if not rows:
        print("ERROR: 未解析到任何数据行", file=sys.stderr)
        sys.exit(1)

    records = []
    for c in rows:
        # date, open, last, high, low, volume, amount, exchange
        date, o, last, h, low, vol, amt = c[0], c[1], c[2], c[3], c[4], c[5], c[6]
        records.append({
            "date": date,
            "open": float(o),
            "high": float(h),
            "low": float(low),
            "close": float(last),
            "volume": int(float(vol)),
            "amount": float(amt),
        })
    # 按日期升序
    records.sort(key=lambda r: r["date"])

    os.makedirs(DATA_DIR, exist_ok=True)
    out_path = os.path.join(DATA_DIR, f"{CODE}_daily.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    cnt = len(records)
    first, last = records[0]["date"], records[-1]["date"]
    print(f"已写入 {out_path}: {cnt} 条, {first} ~ {last}, 末收 {records[-1]['close']}")
    return records, cnt, first, last


if __name__ == "__main__":
    main()
