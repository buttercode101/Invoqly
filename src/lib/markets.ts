export type MarketProfile=Readonly<{countryCode:string;defaultLocale:string;defaultCurrency:string;taxSystem:"vat"|"sales-tax"|"none"|"configured"}>;
export const initialMarketProfiles:readonly MarketProfile[]=[{countryCode:"ZA",defaultLocale:"en-ZA",defaultCurrency:"ZAR",taxSystem:"vat"}];
export function getMarketProfile(countryCode:string):MarketProfile|undefined{return initialMarketProfiles.find(m=>m.countryCode===countryCode.toUpperCase());}
