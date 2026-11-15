import { z } from 'zod'
import { createError } from 'h3'
export const badgeStyles = ['flat', 'flat-square', 'plastic', 'for-the-badge'] as const
export type BadgeStyle = typeof badgeStyles[number]
const color = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
const querySchema = z.object({
 label:z.string().max(256).refine(value=>Array.from(value).length<=128).optional(),
 style:z.enum(badgeStyles).optional(),labelColor:color.optional(),color:color.optional(),
 upColor:color.optional(),downColor:color.optional(),pendingColor:color.optional(),maintenanceColor:color.optional(),
 hours:z.string().regex(/^[1-9]\d{0,4}$/).transform(Number).pipe(z.number().int().min(1).max(9600)).optional()
}).strict()
function invalid(message:string):never{throw createError({statusCode:400,message})}
export function parseBadgeQuery(input:unknown,allowHours=false){
 const parsed=querySchema.safeParse(input)
 if(!parsed.success||!allowHours&&parsed.data.hours!==undefined)return invalid('Invalid badge query')
 return parsed.data
}
export function parseBadgeId(input:unknown){
 if(typeof input!=='string'||!/^[1-9]\d*$/.test(input)||!Number.isSafeInteger(Number(input)))return invalid('Invalid monitor ID')
 return Number(input)
}
export function parseBadgeDuration(input:unknown):number{
 if(input==='1y')return 8760
 if(typeof input!=='string')return invalid('Invalid badge duration')
 const match=/^([1-9]\d{0,4})(h|d)?$/.exec(input)
 const hours=match?Number(match[1])*(match[2]==='d'?24:1):0
 if(!Number.isSafeInteger(hours)||hours<1||hours>9600)return invalid('Badge duration must be between 1 and 9600 hours')
 return hours
}
export function badgeText(input:string){
 if(typeof input!=='string')throw new TypeError('Badge text must be a string')
 return Array.from(input).slice(0,128).join('').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu,'')
}
export function badgeColor(input:string){
 if(!color.safeParse(input).success)throw new TypeError('Invalid badge color')
 return input
}
export function badgeStyle(input:string):BadgeStyle{
 if(!badgeStyles.includes(input as BadgeStyle))throw new TypeError('Invalid badge style')
 return input as BadgeStyle
}
