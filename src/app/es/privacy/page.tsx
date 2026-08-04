// Spanish twin of /privacy. Same component; locale resolves from the /es path.
//
// generateMetadata is re-exported alongside the page on purpose. Without it this route inherited the
// root layout's metadata, so a Spanish privacy policy served an English tab title and no hreflang.
// The English page and this one must advertise the SAME language map or Google ignores it on both,
// and exporting the one shared function is what makes that impossible to get wrong.
export { default, generateMetadata } from '../../privacy/page';
