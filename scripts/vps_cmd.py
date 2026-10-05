import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def run_ssh(cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect('213.136.76.153', username='root', password='qLAPgtTM2R5d', timeout=30)
        print(f"=== RUNNING ON VPS: {cmd} ===")
        stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
        for line in iter(stdout.readline, ""):
            print(line, end="")
        exit_status = stdout.channel.recv_exit_status()
        print(f"\n=== EXIT CODE: {exit_status} ===")
        ssh.close()
        return exit_status
    except Exception as e:
        print(f"SSH ERROR: {e}")
        return 1

if __name__ == '__main__':
    command = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "docker ps"
    sys.exit(run_ssh(command))
