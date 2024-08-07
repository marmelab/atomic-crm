import * as ghpages from 'gh-pages';

ghpages.publish(
    'dist',
    {
        branch: 'gh-pages',
    },
    function (err) {
        if (err) {
            console.error('Failed to deploy to GitHub Pages', err);
        }
    }
);
