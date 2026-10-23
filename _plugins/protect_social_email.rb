# ponytail: al_folio_core 1.0.15 renders {% social_links %} without al_email_protect's
# filter, so the email icon ships a plain mailto:. Swap that anchor for the split-address
# markup al_email_protect's runtime expects. Delete this file once the theme does it itself.
Jekyll::Hooks.register [:pages, :documents], :post_render do |doc|
  next unless AlEmailProtect.enabled?(doc.site) && doc.output&.include?("mailto:")

  doc.output = doc.output.gsub(%r{<a href="mailto:([^"]+)"([^>]*)>}) do
    local, domain = AlEmailProtect.split_address(CGI.unescape(Regexp.last_match(1)))
    next Regexp.last_match(0) unless local

    %(<a href="#" class="al-email-protect"#{Regexp.last_match(2)} data-eu="#{CGI.escapeHTML(local)}" data-ed="#{CGI.escapeHTML(domain)}">)
  end
end
