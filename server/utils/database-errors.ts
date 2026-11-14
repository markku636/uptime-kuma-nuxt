/** Retry only recognized transport/transient failures, never auth/schema/constraint errors. */
export function transientDatabaseError(error:any){
  const codes=new Set(['P1001','P1002','P1008','P1017','P2024','CONTROL_QUERY_TIMEOUT','CONTROL_CONNECT_TIMEOUT','ECONNRESET','ECONNREFUSED','ETIMEDOUT','EPIPE','ENETUNREACH','EHOSTUNREACH','08000','08003','08006','08001','08004','57P01','57P02','57P03','40001','40P01','55P03','57014'])
  if(codes.has(error?.code))return true
  if(error?.code==='P2010'&&codes.has(error?.meta?.code))return true
  return ['ConnectionClosed','ConnectionTimeout','SocketTimeout'].includes(error?.cause?.kind)
}
