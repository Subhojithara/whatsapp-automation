const net = require('net');
const { spawn } = require('child_process');

const pyScript = `
import socket, sys, threading

s = socket.socket()
s.connect(('127.0.0.1', 8080))

def to_sock():
    while True:
        try:
            d = sys.stdin.buffer.raw.read(4096)
            if not d: break
            s.sendall(d)
        except: break

def to_stdout():
    while True:
        try:
            d = s.recv(4096)
            if not d: break
            sys.stdout.buffer.write(d)
            sys.stdout.buffer.flush()
        except: break

t1 = threading.Thread(target=to_sock, daemon=True)
t2 = threading.Thread(target=to_stdout, daemon=True)
t1.start()
t2.start()
t1.join()
t2.join()
`;

const server = net.createServer((clientSocket) => {
  const wslProc = spawn('wsl', ['-e', 'python3', '-c', pyScript], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  clientSocket.pipe(wslProc.stdin);
  wslProc.stdout.pipe(clientSocket);

  clientSocket.on('error', () => wslProc.kill());
  wslProc.on('error', () => clientSocket.destroy());
  wslProc.on('exit', () => clientSocket.destroy());
});

server.listen(8080, '127.0.0.1', () => {
  console.log('[Podman Bridge] Windows 127.0.0.1:8080 -> Podman Container in WSL');
});
