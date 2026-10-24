export const categories = [
  "Electronics",
  "Clothing",
  "Wallet",
  "University ID",
  "Keys",
  "Backpack",
  "Water Bottle",
  "Jewelry",
  "School Supplies",
  "Other",
];
export interface CategoryFields {
  itemLabel: string;
  itemPlaceholder: string;
  descriptionPlaceholder: string;
  brand: boolean;
  model: boolean;
  size: boolean;
  privatePlaceholder: string;
}
const generic: CategoryFields = {
  itemLabel: "Item type",
  itemPlaceholder: "e.g. Notebook",
  descriptionPlaceholder: "Describe the item. These details are private.",
  brand: false,
  model: false,
  size: false,
  privatePlaceholder:
    "A unique marking or detail that can help verify ownership.",
};
export const fieldsFor = (category: string): CategoryFields =>
  ({
    Electronics: {
      ...generic,
      itemLabel: "Device type",
      itemPlaceholder: "e.g. Wireless earbuds",
      brand: true,
      model: true,
      descriptionPlaceholder: "Case, accessories, or distinguishing details.",
      privatePlaceholder:
        "A serial number fragment, engraving, or device-specific marking. Do not include passwords.",
    },
    Clothing: {
      ...generic,
      itemLabel: "Clothing type",
      itemPlaceholder: "e.g. Zip-up jacket",
      brand: true,
      size: true,
      descriptionPlaceholder: "Material, pattern, or other helpful details.",
      privatePlaceholder: "A label, alteration, or distinctive mark.",
    },
    Wallet: {
      ...generic,
      itemLabel: "Wallet type",
      itemPlaceholder: "e.g. Bifold wallet",
      descriptionPlaceholder: "General appearance. Do not enter card numbers.",
      privatePlaceholder:
        "Describe a distinctive feature or contents. Never include financial account numbers.",
    },
    "University ID": {
      ...generic,
      itemLabel: "ID type",
      itemPlaceholder: "e.g. Student access card",
      descriptionPlaceholder:
        "General appearance only. Do not enter an ID number.",
      privatePlaceholder:
        "Contact the campus ID office for verification. Do not include a full student ID number.",
    },
    Keys: {
      ...generic,
      itemLabel: "Key type",
      itemPlaceholder: "e.g. House keys",
      descriptionPlaceholder: "General appearance, keyring, or number of keys.",
      privatePlaceholder:
        "A distinctive keychain or marking. Do not include your home address.",
    },
    Backpack: {
      ...generic,
      itemLabel: "Bag type",
      itemPlaceholder: "e.g. Laptop backpack",
      brand: true,
      descriptionPlaceholder: "Material, style, or visible features.",
      privatePlaceholder: "Describe an item inside or a hidden marking.",
    },
    "Water Bottle": {
      ...generic,
      itemLabel: "Bottle type",
      itemPlaceholder: "e.g. Insulated water bottle",
      brand: true,
      model: true,
      descriptionPlaceholder: "Size, lid style, or distinguishing features.",
      privatePlaceholder: "A sticker, engraving, or concealed marking.",
    },
    Jewelry: {
      ...generic,
      itemLabel: "Jewelry type",
      itemPlaceholder: "e.g. Silver ring",
      descriptionPlaceholder: "General style or material.",
      privatePlaceholder: "An engraving, inscription, or concealed detail.",
    },
    "School Supplies": {
      ...generic,
      itemPlaceholder: "e.g. A5 notebook",
      descriptionPlaceholder: "General appearance and size.",
      privatePlaceholder:
        "An inscription, name on an inside page, or other private detail.",
    },
    Other: generic,
  })[category] || generic;
export const localDateTime = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
