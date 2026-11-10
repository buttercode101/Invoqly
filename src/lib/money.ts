export type Money = Readonly<{ amountMinor: bigint; currency: string }>;
const digits = new Map<string, number>([["BIF",0],["CLP",0],["DJF",0],["GNF",0],["JPY",0],["KMF",0],["KRW",0],["MGA",0],["PYG",0],["RWF",0],["UGX",0],["VND",0],["VUV",0],["XAF",0],["XOF",0],["XPF",0],["BHD",3],["IQD",3],["JOD",3],["KWD",3],["LYD",3],["OMR",3],["TND",3]]);
export function currencyExponent(currency:string):number{if(!/^[A-Z]{3}$/.test(currency))throw new Error("Currency must be a three-letter ISO code.");return digits.get(currency)??2;}
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
