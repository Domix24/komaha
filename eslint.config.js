import eslint from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
	{
		files: ["src/**/*.ts", "api/**/*.ts", "test/**/*.ts"],
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
	},
	eslint.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
)
