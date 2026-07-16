export type TossInvestMode='read_only'|'live';
export type TossInvestConfig={clientId:string;clientSecret:string;accountSeq?:string;mode:TossInvestMode;liveConfirmation?:string;baseUrl?:string;maxRetries?:number};
export type TossAccount={accountNo:string;accountSeq:number;accountType:string};
export type TossPrice={symbol:string;timestamp:string;lastPrice:string;currency:'KRW'|'USD'};
export type TossOrder={orderId:string;clientOrderId:string|null;symbol:string;side:'BUY'|'SELL';orderType:'LIMIT'|'MARKET';status:string;price:string|null;quantity:string|null;currency:'KRW'|'USD';orderedAt:string;execution:{filledQuantity:string;averageFilledPrice:string|null;filledAmount:string|null;commission:string|null;tax:string|null;filledAt:string|null}};
export type TossLimitOrder={clientOrderId:string;symbol:string;side:'BUY'|'SELL';quantity:string;price:string;currency:'KRW'|'USD'};
type ApiEnvelope<T>={result:T}; type TokenResponse={access_token:string;token_type:string;expires_in:number}; type ApiErrorEnvelope={error:{requestId:string;code:string;message:string;data?:unknown}};
type FetchLike=typeof fetch;

export class TossInvestApiError extends Error { constructor(public readonly status:number,public readonly code:string,public readonly requestId:string,public readonly data?:unknown){super(`Toss Invest API error: ${code} (${status})`);} }

export class TossInvestClient {
  private token:{value:string;expiresAt:number}|null=null; private tokenRequest:Promise<string>|null=null;
  private readonly baseUrl:string; private readonly maxRetries:number;
  constructor(private readonly config:TossInvestConfig,private readonly fetcher:FetchLike=fetch,private readonly killSwitchActive:()=>boolean=()=>false) {
    if(!config.clientId||!config.clientSecret)throw new Error('Toss Invest credentials are required');
    if(config.accountSeq!==undefined&&!/^\d+$/.test(config.accountSeq))throw new Error('TOSS_INVEST_ACCOUNT_SEQ must be numeric');
    this.baseUrl=(config.baseUrl??'https://openapi.tossinvest.com').replace(/\/$/,''); this.maxRetries=config.maxRetries??2;
  }
  get mode(){return this.config.mode;}
  get hasAccount(){return this.config.accountSeq!==undefined;}
  async accounts(){return this.request<TossAccount[]>('/api/v1/accounts');}
  async prices(symbols:string[]){if(symbols.length<1||symbols.length>200)throw new Error('symbols must contain 1 to 200 items');return this.request<TossPrice[]>(`/api/v1/prices?symbols=${encodeURIComponent(symbols.join(','))}`);}
  async buyingPower(currency:'KRW'|'USD'){return this.request<{currency:string;cashBuyingPower:string}>(`/api/v1/buying-power?currency=${currency}`,{account:true});}
  async sellableQuantity(symbol:string){return this.request<{sellableQuantity:string}>(`/api/v1/sellable-quantity?symbol=${encodeURIComponent(symbol)}`,{account:true});}
  async order(orderId:string){return this.request<TossOrder>(`/api/v1/orders/${encodeURIComponent(orderId)}`,{account:true});}
  async cancelOrder(orderId:string){this.assertLive();return this.request<{orderId:string}>(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`,{method:'POST',account:true,body:{}});}
  async createLimitOrder(input:TossLimitOrder){
    this.assertLive(); this.validateOrder(input);
    if(input.side==='BUY'){const power=await this.buyingPower(input.currency);const required=Number(input.quantity)*Number(input.price);if(!Number.isFinite(required)||required<=0||required>Number(power.cashBuyingPower))throw new Error('Order exceeds cash buying power');}
    else {const available=await this.sellableQuantity(input.symbol);if(Number(input.quantity)>Number(available.sellableQuantity))throw new Error('Order exceeds sellable quantity');}
    const result=await this.request<{orderId:string;clientOrderId:string|null}>('/api/v1/orders',{method:'POST',account:true,body:{clientOrderId:input.clientOrderId,symbol:input.symbol,side:input.side,orderType:'LIMIT',timeInForce:'DAY',quantity:input.quantity,price:input.price}});
    return {...result,detail:await this.order(result.orderId)};
  }
  private assertLive(){if(this.config.mode!=='live')throw new Error('Toss Invest client is read-only');if(this.config.liveConfirmation!=='I_UNDERSTAND_REAL_ORDERS')throw new Error('Live order confirmation is missing');if(this.killSwitchActive())throw new Error('Kill switch is active');}
  private validateOrder(o:TossLimitOrder){if(!/^[a-zA-Z0-9_-]{1,36}$/.test(o.clientOrderId))throw new Error('Invalid clientOrderId');if(!/^[A-Za-z0-9.\-]+$/.test(o.symbol))throw new Error('Invalid symbol');if(!/^\d+(\.\d+)?$/.test(o.quantity)||Number(o.quantity)<=0)throw new Error('Invalid quantity');if(!/^\d+(\.\d+)?$/.test(o.price)||Number(o.price)<=0)throw new Error('Invalid price');}
  private async accessToken(){const now=Date.now();if(this.token&&this.token.expiresAt-now>60_000)return this.token.value;if(this.tokenRequest)return this.tokenRequest;this.tokenRequest=this.issueToken();try{return await this.tokenRequest}finally{this.tokenRequest=null}}
  private async issueToken(){const body=new URLSearchParams({grant_type:'client_credentials',client_id:this.config.clientId,client_secret:this.config.clientSecret});const response=await this.fetcher(`${this.baseUrl}/oauth2/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});if(!response.ok)await this.throwApiError(response);const value=await response.json() as TokenResponse;this.token={value:value.access_token,expiresAt:Date.now()+value.expires_in*1000};return value.access_token;}
  private async request<T>(path:string,options:{method?:'GET'|'POST';account?:boolean;body?:unknown}={},attempt=0):Promise<T>{const token=await this.accessToken();const headers:Record<string,string>={authorization:`Bearer ${token}`};if(options.account){if(!this.config.accountSeq)throw new Error('TOSS_INVEST_ACCOUNT_SEQ is required for account operations');headers['X-Tossinvest-Account']=this.config.accountSeq;}if(options.body!==undefined)headers['content-type']='application/json';const init:RequestInit={method:options.method??'GET',headers};if(options.body!==undefined)init.body=JSON.stringify(options.body);const response=await this.fetcher(`${this.baseUrl}${path}`,init);if(response.status===401&&attempt===0){this.token=null;return this.request<T>(path,options,1)}if((response.status===429||response.status>=500)&&attempt<this.maxRetries){const retry=Math.min(5,Math.max(0,Number(response.headers.get('retry-after')??1)));await new Promise(resolve=>setTimeout(resolve,retry*1000));return this.request<T>(path,options,attempt+1)}if(!response.ok)await this.throwApiError(response);return((await response.json())as ApiEnvelope<T>).result;}
  private async throwApiError(response:Response):Promise<never>{let value:ApiErrorEnvelope|null=null;try{value=await response.json() as ApiErrorEnvelope}catch{}throw new TossInvestApiError(response.status,value?.error.code??'unknown-error',value?.error.requestId??response.headers.get('x-request-id')??'unknown',value?.error.data);}
}

export function tossInvestConfigFromEnv(env:NodeJS.ProcessEnv=process.env):TossInvestConfig|null {const clientId=env.TOSS_INVEST_CLIENT_ID;const clientSecret=env.TOSS_INVEST_CLIENT_SECRET;if(!clientId||!clientSecret)return null;return{clientId,clientSecret,mode:env.TOSS_INVEST_MODE==='live'?'live':'read_only',...(env.TOSS_INVEST_ACCOUNT_SEQ?{accountSeq:env.TOSS_INVEST_ACCOUNT_SEQ}:{}),...(env.TOSS_INVEST_LIVE_CONFIRM?{liveConfirmation:env.TOSS_INVEST_LIVE_CONFIRM}:{})};}
