export function allowedOrigins(primary:string,additional=process.env.APP_ALLOWED_ORIGINS||''){
 const inputs=[primary,...additional.split(',').map(value=>value.trim()).filter(Boolean)]
 if(inputs.length>8)throw Error('Too many allowed origins')
 return [...new Set(inputs.map(value=>{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.hostname.includes('*'))throw Error('Invalid allowed origin');return url.origin}))]
}
