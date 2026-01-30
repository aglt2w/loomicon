# -*- coding: utf-8 -*-  # 必须加，防止中文/SVG乱码
import sys
import os
import json
sys.stdout.reconfigure(encoding='utf-8')  # 必须加，Windows中文兼容

# 1. 分类映射：英文文件夹名 → 中文分类名（已定义，现在要用上）
CATEGORY_MAP = {
    "function": "功能标识",
    "category": "服装品类",
    "basic": "基础图标",
    "logo": "LOGO",
    "OMCemoji": "OMC表情",
}

# 2. 可选：图标名映射（英文文件名 → 中文图标名，按需补充）
# 比如 "user-icon.svg" → 图标名显示"用户图标"，没有的会保留原文件名
ICON_NAME_MAP = {
    "t-shirt": "T恤",
    "pants": "裤子",
    "hat": "帽子",
    "bag": "背包",
    # 按你的SVG文件名继续补充...
}

ICON_DIR = "assets/icons"  # 确认和你的文件夹名完全一致
OUTPUT_FILE = "icon-list.json"

def main():
    icon_list = []
    for folder_name in os.listdir(ICON_DIR):
        folder_path = os.path.join(ICON_DIR, folder_name)
        # 只处理CATEGORY_MAP里有的文件夹（确保分类能转中文）
        if not os.path.isdir(folder_path) or folder_name not in CATEGORY_MAP:
            continue
        
        # 核心修改1：把英文文件夹名转成中文分类名
        chinese_category = CATEGORY_MAP[folder_name]
        
        for filename in os.listdir(folder_path):
            if filename.lower().endswith(".svg"):
                # 获取图标文件名（去掉.svg）
                icon_name_en = os.path.splitext(filename)[0]
                svg_file_path = os.path.join(folder_path, filename)
                
                # 关键：确保正确读取SVG内容
                try:
                    with open(svg_file_path, "r", encoding="utf-8") as f:
                        svg_content = f.read().strip()
                    # 验证：打印读取的SVG开头（可选）
                    print(f"✅ 读取{icon_name_en}：{svg_content[:20]}...")
                except Exception as e:
                    print(f"❌ 读取{svg_file_path}失败：{e}")
                    svg_content = ""  # 避免报错中断
                
                # 核心修改2：图标名转中文（有映射就用中文，没有就保留原名）
                icon_name = ICON_NAME_MAP.get(icon_name_en, icon_name_en)
                
                # 组装数据：分类和图标名都用中文（或映射后的名称）
                icon_list.append({
                    "name": icon_name,          # 中文图标名（或原英文名）
                    "category": chinese_category, # 中文分类名（核心！）
                    "svg": svg_content
                })
    
    # 写入JSON（ensure_ascii=False 保留中文和SVG特殊字符）
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(icon_list, f, ensure_ascii=False, indent=2)  # 加indent更易读
    
    print(f"\n✅ 生成完成：共{len(icon_list)}个图标，分类已全部转为中文！")

if __name__ == "__main__":

    main()


