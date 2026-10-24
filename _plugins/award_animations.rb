# Loads the Lottie player and award-anim.js on pages that show award icons
# (publication lists and the CV), since the CV layout has no slot for page scripts.
SCRIPTS = '<script src="/assets/js/vendor/lottie_light-5.12.2.min.js" defer></script>' \
          '<script src="/assets/js/award-anim.js" defer></script>'

Jekyll::Hooks.register [:pages, :documents], :post_render do |doc|
  next unless doc.output&.include?("publication_preview/") && doc.output.include?("</body>")

  doc.output = doc.output.sub("</body>", "#{SCRIPTS}</body>")
end
