// Real product names/standard servings with official nutrition; fictional DEMO prices and availability.
const make=(id,name,role,priceCents,art)=>({id,name,role,priceCents,art,variantId:'standard',available:true});
export const demoCatalog={source:'demo',store:{id:'demo',name:'演示菜单'},items:[
 make('beef','汉堡包','main',1500,'burger'),make('chicken','麦辣鸡腿汉堡','main',1300,'chicken'),
 make('double','双层吉士汉堡','main',1900,'burger'),make('fish','麦香鱼','main',1600,'fish'),make('grilled','板烧鸡腿堡','main',1800,'chicken'),
 make('fries','薯条（小）','side',700,'fries'),make('nuggets','麦乐鸡（5块）','side',800,'nuggets'),make('pie','菠萝派','side',600,'pie'),make('corn','玉米杯（小）','side',700,'corn'),
 make('cola','可口可乐（小）','drink',500,'cola'),make('tea','锡兰红茶','drink',600,'tea'),make('coffee','热美式（小）','drink',800,'coffee'),make('juice','【美汁源】“黄金橙橙”（中）','drink',700,'juice'),make('zero','无糖可口可乐（中）','drink',500,'cola')
]};
