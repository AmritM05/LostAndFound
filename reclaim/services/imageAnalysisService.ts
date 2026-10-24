// Failure-safe fallback: no image recognition is claimed without a configured provider.
export async function extractItemAttributes(image: string, description = "") {
  return {
    category: "Other",
    brand: "",
    model: "",
    primaryColor: "",
    secondaryColor: "",
    visibleText: "",
    distinguishingFeatures: description,
    confidence: 0,
    source: "manual" as const,
  };
}
export async function generateImageEmbedding(
  _image: string,
): Promise<number[] | null> {
  return null;
}
