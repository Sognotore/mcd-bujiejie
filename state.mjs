export const initialState=()=>({mode:'demo',budget:'',meal:null,draftId:null,locks:[],revision:0,busy:false,error:'',message:'',stale:false,store:null});
export const changeCondition=(state,patch)=>({...state,...patch,meal:null,draftId:null,locks:[],revision:state.revision+1,busy:false,error:'',message:'',stale:false});
export const applyResponse=(state,revision,response)=>revision!==state.revision?state:{...state,meal:response.meal,draftId:response.draftId??null,store:response.store??state.store,busy:false,error:'',message:response.message??'',stale:false};
export const applyFailure=(state,revision,error)=>revision!==state.revision?state:{...state,busy:false,error,stale:Boolean(state.meal)};
