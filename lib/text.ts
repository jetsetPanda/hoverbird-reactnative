// Android/Fabric clips the final glyph of a content-sized <Text> (e.g. inside
// a pill or icon+label row that shrink-wraps its label). A trailing
// non-breaking space keeps its advance width — unlike a regular space, which
// StaticLayout strips — so the real last character isn't sitting on the
// clipped line boundary. Use this on any shrink-wrapped label.
export function noClip(label: string): string {
  // String.fromCharCode(160) is a non-breaking space.
  return label + String.fromCharCode(160);
}
