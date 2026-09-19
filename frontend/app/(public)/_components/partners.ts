/**
 * Authorised university partners shown on the homepage carousel.
 *
 * HOW TO ADD A LOGO:
 * 1. Save the file under `frontend/public/partners/` (SVG preferred, PNG
 *    with a transparent background otherwise).
 * 2. Add one line below with the university name and the file path.
 * 3. Only confirmed, authorised partners go here - never prospects.
 *
 * The carousel section hides itself while this list is empty, so the
 * homepage is unaffected until the first logo lands.
 */
export interface Partner {
  name: string;
  /** Path under /public, e.g. "/partners/christ.svg". */
  logo: string;
}

export const PARTNERS: Partner[] = [
  // { name: 'Christ University', logo: '/partners/christ.svg' },
];
