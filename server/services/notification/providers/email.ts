// SMTP is not implemented; never acknowledge a placeholder as delivered.
export const emailProvider={async send(..._args:unknown[]){throw new Error('UNSUPPORTED_PROVIDER')}}
