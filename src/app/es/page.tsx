// Spanish home. Same component as /, rendered in Spanish because i18n/request.ts resolves the
// locale from the path. This exists so Spanish has a real, indexable, citable URL: locale used to
// live only in the ui_locale cookie, which no crawler sends.
export { default, generateMetadata } from '../page';
