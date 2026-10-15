// Fictional demonstration menu; these are not live McDonald's prices or availability.
const make=(id,name,role,priceCents,art)=>({id,name,role,priceCents,art,variantId:'standard',available:true});
export const demoCatalog={source:'demo',store:{id:'demo',name:'演示菜单'},items:[
 make('beef','经典牛肉堡','main',1500,'burger'),make('chicken','香脆鸡腿堡','main',1300,'chicken'),
 make('double','双层芝士堡','main',1900,'burger'),make('fish','酥脆鱼排堡','main',1600,'fish'),
 make('fries','金黄薯条','side',700,'fries'),make('nuggets','香酥鸡块','side',800,'nuggets'),make('pie','香甜苹果派','side',600,'pie'),
 make('cola','冰爽可乐','drink',500,'cola'),make('tea','清香冰茶','drink',600,'tea'),make('coffee','美式咖啡','drink',800,'coffee'),make('juice','清爽橙汁','drink',700,'juice')
]};
