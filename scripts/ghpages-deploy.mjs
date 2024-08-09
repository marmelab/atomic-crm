import * as ghpages from 'gh-pages';

ghpages.publish(
    'dist',
    {
        branch: process.env.DEPLOY_BRANCH || 'gh-pages',
        repo: process.env.DEPLOY_REPO_URL || undefined,
    },
    function (err) {
        if (err) {
            console.error('Failed to deploy to GitHub Pages', err);
        }
    }
);
