import { faker } from "@faker-js/faker";

import { Db } from "./types";

export const generateSales = (_: Db) => {
	const randomSales = Array.from(Array(10).keys()).map((id) => {
		const first_name = faker.person.firstName();
		const last_name = faker.person.lastName();
		const email = faker.internet.email({
			firstName: first_name,
			lastName: last_name,
		});

		return {
			id: id + 1,
			first_name,
			last_name,
			email,
		};
	});
	return [
		{
			id: 0,
			first_name: "Jane",
			last_name: "Doe",
			email: "janedoe@atomic.dev",
		},
		...randomSales,
	];
};
