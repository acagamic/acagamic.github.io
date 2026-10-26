# Forwarding pages for the old acagamic.com (Hugo) addresses listed in _data/legacy_redirects.yml.
# Static hosting has no server redirects, so each old path gets a tiny page with a canonical link and
# an instant meta refresh, which search engines treat as a permanent move.
Jekyll::Hooks.register :site, :post_read do |site|
  Array(site.data['legacy_redirects']).each do |row|
    from = row['from'].to_s
    to = row['to'].to_s
    next if site.pages.any? { |page| page.url == from }

    target = "#{site.config['url']}#{site.baseurl}#{to}"
    page = Jekyll::PageWithoutAFile.new(site, site.source, from, 'index.html')
    page.content = <<~HTML
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>This page has moved</title>
          <link rel="canonical" href="#{target}">
          <meta http-equiv="refresh" content="0; url=#{to}">
          <meta name="robots" content="noindex">
        </head>
        <body>
          <p>This page has moved to <a href="#{to}">#{target}</a>.</p>
        </body>
      </html>
    HTML
    page.data['layout'] = nil
    page.data['sitemap'] = false
    site.pages << page
  end
end
