import subprocess
import sys
from datetime import datetime
import os

def run_python_script(script_path):
    """运行指定的Python脚本（用于更新JSON文件）"""
    try:
        print(f"[开始] 运行JSON更新脚本: {script_path}")
        result = subprocess.run(
            [sys.executable, script_path],
            check=True,
            capture_output=True,
            text=True,
            encoding='utf-8'  # 👉 新增：强制UTF-8编码解码输出
        )
        print(f"[成功] JSON更新脚本执行完成，输出: {result.stdout.strip() if result.stdout else '无输出'}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[警告] JSON更新脚本执行出错: {e.stderr.strip() if e.stderr else '无错误信息'}（继续执行推送流程）")
        return False
    except FileNotFoundError:
        print(f"[警告] 找不到指定的JSON脚本: {script_path}（继续执行推送流程）")
        return False

def git_commit_and_push(commit_msg=None):
    """执行Git提交和推送操作（新增git pull防冲突）"""
    if not commit_msg:
        commit_msg = f"自动更新JSON文件 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    
    # 拉取远程最新代码
    try:
        print("[开始] 拉取GitHub远程最新代码...")
        pull_result = subprocess.run(
            ["git", "pull", "origin", "main"],
            check=True,
            capture_output=True,
            text=True,
            cwd=os.getcwd(),
            encoding='utf-8'  # 👉 新增：强制UTF-8编码
        )
        print(f"[成功] 拉取远程代码完成: {pull_result.stdout.strip() if pull_result.stdout else '无更新'}")
    except subprocess.CalledProcessError as e:
        print(f"[失败] 拉取远程代码出错（可能无新内容）: {e.stderr.strip() if e.stderr else '无错误信息'}")
    
    git_commands = [
        ["git", "add", "."],
        ["git", "commit", "-m", commit_msg],
        ["git", "push", "origin", "main"]
    ]
    
    for cmd in git_commands:
        try:
            print(f"[开始] 执行Git命令: {' '.join(cmd)}")
            result = subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                text=True,
                cwd=os.getcwd(),
                encoding='utf-8'  # 👉 新增：所有Git命令都加UTF-8编码
            )
            print(f"[成功] Git命令执行完成: {result.stdout.strip() if result.stdout else '无输出'}")
        except subprocess.CalledProcessError as e:
            print(f"[失败] Git命令执行出错: {e.stderr.strip() if e.stderr else '无错误信息'}")
            return False
        except Exception as e:
            print(f"[失败] 未知错误: {str(e)}")
            return False
    return True

if __name__ == "__main__":
    JSON_UPDATE_SCRIPT_PATH = "./generate-icon-list.py"
    CUSTOM_COMMIT_MSG = ""

    # 步骤1：运行JSON更新脚本（失败不终止）
    run_python_script(JSON_UPDATE_SCRIPT_PATH)
    
    # 步骤2：执行Git提交和推送
    if git_commit_and_push(CUSTOM_COMMIT_MSG):
        print("\n✅ 全部流程完成：代码已推送到GitHub")
    else:
        print("\n❌ Git提交/推送失败，请检查仓库状态和网络")
        sys.exit(1)