begin;
-- Fix abbreviated phone model aliases without rewriting reports or weakening
-- generation/variant/brand contradictions. No threshold or recovery changes.
create or replace function matching_policy() returns jsonb language sql immutable as $policy$
 select '{"version":"compatibility-v3-phone-family","unknown":["","unknown","not known","not sure","unsure","uncertain","n a","na","none","null","undefined","other","generic","unbranded","no brand","not provided","not specified","not applicable","unidentified","multicolor","multi color","mixed","various","dont know","do not know","dont remember","cannot remember","cant remember","cannot recall","unspecified","unavailable","not recorded","to be determined","tbd"],"brand":{"apple inc":"apple","apple computer":"apple","appple":"apple","samsung electronics":"samsung","sam sung":"samsung","samung":"samsung","nike inc":"nike","addidas":"adidas","adidas ag":"adidas","the north face":"north face","tnf":"north face","jan sport":"jansport","hewlett packard":"hp","h p":"hp","h m":"hm","hydroflask":"hydro flask","fj llr ven":"fjallraven"},"category":{"electronics":"electronics","electronic":"electronics","electronic devices":"electronics","devices":"electronics","clothing":"clothing","clothes":"clothing","apparel":"clothing","wallet":"wallet cards","wallets":"wallet cards","wallets cards":"wallet cards","wallets and cards":"wallet cards","cards":"wallet cards","university id":"wallet cards","student id":"wallet cards","id card":"wallet cards","keys":"keys","key":"keys","keyring":"keys","backpack":"backpack","backpacks":"backpack","bags":"backpack","bags backpacks":"backpack","bag":"backpack","rucksack":"backpack","water bottle":"bottle","water bottles":"bottle","bottle":"bottle","bottles":"bottle","drinkware":"bottle","jewelry":"jewelry","jewellery":"jewelry","school supplies":"supplies","stationery":"supplies","school supply":"supplies","books supplies":"supplies"},"color":{"black":"black","jet black":"black","matte black":"black","white":"white","off white":"cream","ivory":"cream","cream":"cream","blue":"blue","navy":"dark blue","navy blue":"dark blue","dark blue":"dark blue","light blue":"light blue","sky blue":"light blue","gray":"gray","grey":"gray","dark gray":"dark gray","dark grey":"dark gray","charcoal":"dark gray","charcoal gray":"dark gray","light grey":"light gray","light gray":"light gray","silver":"silver","yellow":"yellow","bright yellow":"yellow","gold":"gold","golden":"gold","red":"red","bright red":"red","maroon":"dark red","burgundy":"dark red","dark red":"dark red","green":"green","dark green":"dark green","forest green":"dark green","olive":"dark green","brown":"brown","dark brown":"brown","tan":"tan","beige":"tan","orange":"orange","pink":"pink","purple":"purple","violet":"purple"},"colorFamily":{"dark blue":"blue","light blue":"blue","dark gray":"gray","light gray":"gray","dark red":"red","dark green":"green"},"colorNeighbors":[["black","dark blue"],["black","dark gray"],["gray","silver"],["white","cream"],["brown","tan"],["yellow","gold"]],"model":{"airpodspro":"airpods pro","airpodspro2":"airpods pro 2","airpods pro ii":"airpods pro 2","galaxybuds":"galaxy buds","galaxy buds2":"galaxy buds 2","galaxy buds2 pro":"galaxy buds 2 pro","iphone13":"iphone 13","iphone14":"iphone 14","iphone15":"iphone 15","iphone16":"iphone 16"},"modelFamilies":["airpods","airpods pro","galaxy buds","iphone","ipad","macbook","macbook pro","surface","thinkpad"],"genericModels":["earbuds","wireless earbuds","headphones","phone","smartphone","laptop","computer","backpack","bag","wallet","bottle","water bottle","case","pro","standard","regular"],"itemTypes":{"audio":["earbuds","earbud","earphones","headphones","headphone","airpods","air pods","galaxy buds","headset"],"phone":["phone","smartphone","iphone"],"laptop":["laptop","macbook","notebook computer","thinkpad"],"tablet":["tablet","ipad"],"backpack":["backpack","rucksack"],"wallet":["wallet","bifold"],"bottle":["bottle","flask"],"keys":["keys","keyring","keychain"],"id card":["student id","id card","access card"],"ring":["ring"],"necklace":["necklace"],"jacket":["jacket","coat"],"shoes":["shoes","sneakers","trainers"],"umbrella":["umbrella"]},"identifierKinds":{"serial":"serial","serial number":"serial","imei":"imei","asset tag":"asset tag","device id":"device id"}}'::jsonb
$policy$;
create or replace function matching_model(v text,brand text,name text) returns text language plpgsql immutable as $$
declare t text:=matching_known(v); prefix text; recognized boolean;
begin
 if t is null then return null;end if;
 if t ~ '\m(or|either|not)\M' then return null;end if;
 t:=regexp_replace(t,'\mair pods\M','airpods','g');
 t:=regexp_replace(t,'\m(first|1st) (gen|generation)\M','1','g');
 t:=regexp_replace(t,'\m(second|2nd) (gen|generation)\M','2','g');
 t:=regexp_replace(t,'\m(third|3rd) (gen|generation)\M','3','g');
 t:=regexp_replace(t,'\m(fourth|4th) (gen|generation)\M','4','g');
 t:=regexp_replace(t,'\m(gen|generation) ?([1-4])\M','\2','g');
 foreach prefix in array array[matching_known(brand),matching_attribute('brand',brand)] loop
  if prefix is not null and left(t,length(prefix)+1)=prefix||' ' then t:=substr(t,length(prefix)+2);end if;
 end loop;
 if matching_attribute('brand',brand)='apple' and matching_item_type(name)='phone'
 and t ~ '^[0-9]{1,2}( (pro|max|plus|mini|e|air))*$' then t:='iphone '||t;end if;
 t:=coalesce(matching_policy()->'model'->>t,t);
 if matching_policy()->'genericModels' ? t then return null;end if;
 select exists(select 1 from jsonb_array_elements_text(matching_policy()->'modelFamilies') f where t=f or left(t,length(f)+1)=f||' ') into recognized;
 if not recognized and t !~ '[0-9]' and t=matching_text(name) then return null;end if;
 return t;
end $$;
-- Existing staff-only recalculation preserves dismissals, claims, returned
-- history, measured AI and student notifications; only candidate rows change.
do $$ declare staff uuid;begin
 select id into staff from users where role='admin' order by created_at,id limit 1;
 if staff is not null then perform recalculate_potential_matches(staff);end if;
end $$;
commit;
