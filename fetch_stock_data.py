#!/usr/bin/env python3
"""
股票数据规范化获取脚本
根据 stock_data_spec.yaml 配置文件获取股票数据
"""

import subprocess
import csv
import json
import yaml
import os
from datetime import datetime
from pathlib import Path


class StockDataFetcher:
    """股票数据获取器"""
    
    def __init__(self, config_path="stock_data_spec.yaml"):
        """初始化"""
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
        
        self.node_path = "/Users/zhangxiao/.workbuddy/binaries/node/versions/22.22.2/bin/node"
        self.script_path = "/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js"
        
        # 创建输出目录
        self.output_dir = Path(self.config['output']['directory'])
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def run_westock_command(self, args):
        """运行 westock-data 命令"""
        cmd = [self.node_path, self.script_path] + args
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.config['execution']['timeout_seconds']
            )
            return result.stdout
        except Exception as e:
            print(f"命令执行失败: {e}")
            return None
    
    def parse_table_output(self, output):
        """解析表格输出为字典列表"""
        if not output:
            return []
        
        lines = output.strip().split('\n')
        if len(lines) < 2:
            return []
        
        # 解析表头
        headers = [h.strip() for h in lines[0].split('|')[1:-1]]
        
        # 解析数据行
        data = []
        for line in lines[2:]:  # 跳过分隔线
            if line.strip():
                values = [v.strip() for v in line.split('|')[1:-1]]
                row = dict(zip(headers, values))
                data.append(row)
        
        return data
    
    def save_to_csv(self, data, filename):
        """保存数据到CSV文件"""
        if not data:
            print(f"没有数据保存到 {filename}")
            return
        
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', encoding=self.config['output']['encoding'], newline='') as f:
            writer = csv.DictWriter(f, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        
        print(f"数据已保存到: {filepath}")
    
    def fetch_quote(self, stock_code, stock_name):
        """获取实时行情"""
        if not self.config['data_dimensions']['quote']['enabled']:
            return
        
        print(f"\n正在获取 {stock_name}({stock_code}) 的实时行情...")
        output = self.run_westock_command(['quote', stock_code])
        data = self.parse_table_output(output)
        
        if data:
            filename = f"{stock_code}_quote_{datetime.now().strftime('%Y-%m-%d')}.csv"
            self.save_to_csv(data, filename)
        
        return data
    
    def fetch_kline(self, stock_code, stock_name):
        """获取K线数据（复权）"""
        if not self.config['data_dimensions']['kline']['enabled']:
            return
        
        kline_config = self.config['data_dimensions']['kline']
        period = kline_config['period']
        limit = kline_config['limit']
        fq = kline_config.get('fq', 'qfq')  # 默认前复权
        
        fq_names = {'qfq': '前复权', 'hfq': '后复权', 'bfq': '不复权'}
        fq_label = fq_names.get(fq, fq)
        
        print(f"\n正在获取 {stock_name}({stock_code}) 的K线数据 [{fq_label}]...")
        
        args = ['kline', stock_code, '--period', period, '--fq', fq, '--limit', str(limit)]
        output = self.run_westock_command(args)
        data = self.parse_table_output(output)
        
        if data:
            filename = f"{stock_code}_kline_{period}_{fq}_{datetime.now().strftime('%Y-%m-%d')}.csv"
            self.save_to_csv(data, filename)
        
        return data
    
    def fetch_finance(self, stock_code, stock_name):
        """获取财务数据"""
        if not self.config['data_dimensions']['finance']['enabled']:
            return
        
        print(f"\n正在获取 {stock_name}({stock_code}) 的财务数据...")
        output = self.run_westock_command(['finance', stock_code])
        
        # 财务数据输出格式特殊，需要单独解析
        if output:
            # 这里需要根据实际输出格式进行解析
            # 暂时保存原始输出
            filename = f"{stock_code}_finance_{datetime.now().strftime('%Y-%m-%d')}.txt"
            filepath = self.output_dir / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(output)
            print(f"财务数据已保存到: {filepath}")
        
        return output
    
    def fetch_all_stocks(self):
        """获取所有配置的股票数据"""
        stocks = self.config['stocks']
        
        for stock in stocks:
            name = stock['name']
            code = stock['code']
            market = stock.get('market', '')
            currency = stock.get('currency', '')
            group = stock.get('group', name)
            
            if not code:
                print(f"跳过 {name}: 没有配置股票代码")
                continue
            
            print(f"\n{'='*50}")
            print(f"正在处理: {name} ({code}) [{market} {currency}]")
            print(f"{'='*50}")
            
            # 获取各类数据
            self.fetch_quote(code, name)
            self.fetch_kline(code, name)
            self.fetch_finance(code, name)
            
            print(f"\n{name} ({code}) 数据获取完成")
        
        print(f"\n{'='*50}")
        print("所有股票数据获取完成！")
        print(f"输出目录: {self.output_dir.absolute()}")
        print(f"{'='*50}")


def main():
    """主函数"""
    config_path = "stock_data_spec.yaml"
    
    if not os.path.exists(config_path):
        print(f"配置文件不存在: {config_path}")
        return
    
    fetcher = StockDataFetcher(config_path)
    fetcher.fetch_all_stocks()


if __name__ == "__main__":
    main()
