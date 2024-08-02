import { input } from '@inquirer/prompts';
import { execa } from 'execa';
import fs from 'node:fs';

(async () => {
    await loginToSupabase();
    const projectName = await input({
        message: 'Enter the name of the project:',
        default: 'Atomic CRM',
    });
    const databasePassword = await input({
        message: 'Enter a database password:',
        default: generatePassword(16),
    });

    const projectRef = await createProject({ projectName, databasePassword });

    // This also ensures the project is ready
    const { anonKey } = await fetchApiKeys({
        projectRef,
    });

    await linkProject({
        projectRef,
        databasePassword,
    });

    await setupDatabase({
        databasePassword,
    });

    await persistSupabaseEnv({
        projectRef,
        anonKey,
    });
})();

async function loginToSupabase() {
    await execa('npx', ['supabase', 'login'], { stdio: 'inherit' });
}

async function createProject({ projectName, databasePassword }) {
    const { stdout } = await execa(
        'npx',
        [
            'supabase',
            'projects',
            'create',
            '--interactive',
            '--db-password',
            databasePassword,
            projectName,
        ],
        {
            stdin: 'inherit',
            stdout: ['inherit', 'pipe'],
        }
    );

    const projectRef = stdout.match(
        /https:\/\/supabase.com\/dashboard\/project\/([a-zA-Z0-9_-]*)/
    )[1];

    return projectRef;
}

let retry = 0;
async function linkProject({ projectRef, databasePassword }) {
    await execa(
        'npx',
        [
            'supabase',
            'link',
            '--project-ref',
            projectRef,
            '--password',
            databasePassword,
        ],
        {
            stdout: 'inherit',
            stderr: 'ignore',
        }
    ).catch(() => {
        retry++;
        if (retry === 1) {
            console.log('Waiting for project to be ready...');
        }
        return sleep(1000).then(() =>
            linkProject({ projectRef, databasePassword })
        );
    });
}

async function setupDatabase({ databasePassword }) {
    await execa(
        'npx',
        [
            'supabase',
            'db',
            'push',
            '--linked',
            '--include-roles',
            '--password',
            databasePassword,
        ],
        {
            stdio: 'inherit',
        }
    );
}

async function fetchApiKeys({ projectRef }) {
    let anonKey = '';

    try {
        const { stdout } = await execa(
            'npx',
            ['supabase', 'projects', 'api-keys', '--project-ref', projectRef],
            {
                stderr: 'ignore',
            }
        );

        const keys = stdout
            .trim()
            .match(/[ ]+([a-z_]*)[ ]+│[ ]+([a-zA-Z0-9._-]+)/gm);

        for (const key of keys) {
            const [name, value] = key.split('│').map(s => s.trim());
            if (name === 'anon') {
                anonKey = value;
            }
        }
    } catch (e) {}

    if (anonKey === '') {
        await sleep(1000);
        return fetchApiKeys({ projectRef });
    }

    return { anonKey };
}

async function persistSupabaseEnv({ projectRef, anonKey }) {
    let envFileStream = fs.createWriteStream(
        `${process.cwd()}/.env.production.local`,
        { flags: 'a' }
    );
    await execa(
        'echo',
        [`VITE_SUPABASE_URL=https://${projectRef}.supabase.co`],
        {
            stdout: [envFileStream, 'pipe'],
        }
    );
    envFileStream = fs.createWriteStream(
        `${process.cwd()}/.env.production.local`,
        { flags: 'a' }
    );
    await execa('echo', [`VITE_SUPABASE_ANON_KEY=${anonKey}`], {
        stdout: [envFileStream, 'pipe'],
    });
}

function generatePassword(length) {
    const password = crypto
        // eslint-disable-next-line no-undef
        .getRandomValues(new BigUint64Array(4))
        .reduce(
            (prev, curr, index) =>
                (!index ? prev : prev.toString(36)) +
                (index % 2
                    ? curr.toString(36).toUpperCase()
                    : curr.toString(36))
        )
        .split('')
        .sort(() => 128 - crypto.getRandomValues(new Uint8Array(1))[0])
        .join('');

    if (length) {
        return password.slice(0, length);
    }

    return password;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
