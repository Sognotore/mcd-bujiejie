import {createHash} from 'node:crypto';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
// The identifier is a snapshot of the actual SKU, quantity and default customization, not an authorization token.
export function configurationSnapshot(item){
 const productCode=item.productCode??item.orderLine?.productCode??item.id;
 const lockConfiguration=item.orderLine??item.lockConfiguration??{variantId:item.variantId};
 const fingerprint=createHash('sha256').update(JSON.stringify(canonical({name:item.name,configuration:lockConfiguration}))).digest('hex').slice(0,24);
 return {...item,productCode,lockConfiguration,id:`${productCode}:${fingerprint}`,variantId:fingerprint};
}
