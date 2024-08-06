import * as ghpages from 'gh-pages';

ghpages.publish(
    'dist',
    {
        branch: 'gh-pages',
        user: {
            name: process.env.GIT_USER_NAME || 'Marmebot',
            email: process.env.GIT_USER_EMAIL || 'developer@marmelab.com',
        },
    },
    function (err) {
        if (err) {
            console.error('Failed to deploy to GitHub Pages', err);
        }
    }
);
