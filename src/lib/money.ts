export type Money = Readonly<{ amountMinor: bigint; currency: string }>;
export function currencyExponent(currency:string):number{if(!/^[A-Z]{3}$/.test(currency))throw new Error("Currency must be a three-letter ISO code.");try{return new Intl.NumberFormat("en",{style:"currency",currency}).resolvedOptions().maximumFractionDigits}catch{throw new Error("Unsupported ISO 4217 currency code: "+currency)}}
export function makeMoney(amountMinor:bigint,currency:string):Money{currencyExponent(currency);return Object.freeze({amountMinor,currency});}
export function addMoney(a:Money,b:Money):Money{if(a.currency!==b.currency)throw new Error("Cannot add amounts in different currencies.");return makeMoney(a.amountMinor+b.amountMinor,a.currency);}
export function formatMoney(value:Money,locale:string):string{const exponent=currencyExponent(value.currency);const absolute=value.amountMinor<0n?-value.amountMinor:value.amountMinor;if(absolute>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Amount exceeds the safe formatting range.");const major=Number(value.amountMinor)/(10**exponent);return new Intl.NumberFormat(locale,{style:"currency",currency:value.currency,minimumFractionDigits:exponent,maximumFractionDigits:exponent}).format(major);}

export function decimalToMinor(value:string,currency:string):number{
  const exponent=currencyExponent(currency);
  const match=value.trim().match(/^(\d+)(?:\.(\d+))?$/);
  if(!match)throw new Error("Enter a valid non-negative monetary amount.");
  const fraction=match[2]??"";
  if(fraction.length>exponent)throw new Error("Amount has more decimal places than this currency supports.");
  const minor=BigInt(match[1])*10n**BigInt(exponent)+BigInt((fraction+"0".repeat(exponent)).slice(0,exponent)||"0");
  if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Amount is too large.");
  return Number(minor);
}
export function formatMinor(amountMinor:number,currency:string,locale:string):string{
  if(!Number.isSafeInteger(amountMinor))throw new Error("Money must be stored as safe integer minor units.");
  const exponent=currencyExponent(currency);
  return new Intl.NumberFormat(locale,{style:"currency",currency,minimumFractionDigits:exponent,maximumFractionDigits:exponent}).format(amountMinor/(10**exponent));
}
