import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/draw/open',
      ],
    },
    sitemap: 'https://p-carder.com/sitemap.xml',
  }
}
