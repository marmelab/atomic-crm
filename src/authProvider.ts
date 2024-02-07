import { supabaseAuthProvider } from "ra-supabase";
import { supabase } from "./supabase";

export const authProvider = supabaseAuthProvider(supabase, {
	getIdentity: async (user) => {
		const { data, errorTags: error } = await supabase
			.from("sales")
			.select("id, first_name, last_name, email")
			.match({ user_id: user.id })
			.single();

		if (!data || error) {
			throw new Error();
		}

		return {
			id: data.id,
			fullName: `${data.first_name} ${data.last_name}`,
		};
	},
});
