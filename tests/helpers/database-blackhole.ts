import net from 'node:net'
/** A real TCP blackhole: preserve both sockets and discard packets, without ECONNRESET. */
export async function databaseBlackhole(connectionString:string){
  const target=new URL(connectionString),port=Number(target.port),connections=new Set<net.Socket>()
  let blocked=false
  const server=net.createServer(client=>{
    const upstream=net.connect({host:target.hostname,port});connections.add(client);connections.add(upstream)
    client.on('data',data=>{if(!blocked)upstream.write(data)});upstream.on('data',data=>{if(!blocked)client.write(data)})
    const close=()=>{client.destroy();upstream.destroy();connections.delete(client);connections.delete(upstream)}
    client.on('error',close);upstream.on('error',close);client.on('close',close);upstream.on('close',close)
  })
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));target.port=String((server.address() as net.AddressInfo).port)
  return {url:target.toString(),block(){blocked=true},restore(){blocked=false},async close(){for(const socket of connections)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()))}}
}
