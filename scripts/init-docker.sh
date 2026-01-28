tmpdir=$(mktemp -d 2>/dev/null || mktemp -d -t 'supabase-clone-temp')
git clone --depth 1 https://github.com/supabase/supabase $tmpdir
mkdir -p ./docker
cp -rf $tmpdir/docker/* ./docker
cp $tmpdir/docker/.env.example ./docker/.env
echo "You can safely answer yes to the next script step as it will only modify the .env file we just created for supabase"
cd ./docker && sh ./utils/generate-keys.sh
rm -rf $tmpdir
