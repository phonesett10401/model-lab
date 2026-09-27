/** Each call returns a checker that stays true only until the next call. */
export function latestOnly() {
	let current = 0;
	return () => {
		const mine = ++current;
		return () => mine === current;
	};
}
