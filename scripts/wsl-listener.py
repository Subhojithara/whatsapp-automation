import socket
import threading

def handle(client):
    try:
        remote = socket.socket()
        remote.connect(('127.0.0.1', 8080))
        def fwd(src, dst):
            while True:
                try:
                    data = src.recv(4096)
                    if not data: break
                    dst.sendall(data)
                except:
                    break
            try: src.close()
            except: pass
            try: dst.close()
            except: pass

        t1 = threading.Thread(target=fwd, args=(client, remote), daemon=True)
        t2 = threading.Thread(target=fwd, args=(remote, client), daemon=True)
        t1.start()
        t2.start()
    except Exception as e:
        client.close()

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(('0.0.0.0', 8088))
s.listen(50)
print('[WSL Bridge] Listening on 0.0.0.0:8088 -> Podman 127.0.0.1:8080', flush=True)

while True:
    client, _ = s.accept()
    handle(client)
