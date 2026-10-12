# Adds ".js" to extension-less relative imports so plain Node can load Vite-style sources.
undef $/;
$_ = <STDIN>;
s{(from\s+')(\.[^']*?)(')}{ my ($a, $b, $c) = ($1, $2, $3); $b =~ /\.(?:js|jsx|json|css)$/ ? "$a$b$c" : "$a$b.js$c" }ge;
print;
