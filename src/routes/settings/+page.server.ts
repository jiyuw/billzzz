import type { PageServerLoad, Actions } from './$types';
import { getAllCategories, getAllPaymentMethods, getAllAssetTags } from '$lib/server/db/queries';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import {
	bills,
	billCycles,
	billPayments,
	categories,
	assetTags,
	paymentMethods,
	userPreferences
} from '$lib/server/db/schema';

interface ImportData {
	version: string;
	exportDate: string;
	data: {
		categories: any[];
		assetTags?: any[];
		bills: any[];
		billCycles: any[];
		billPayments: any[];
		paymentMethods?: any[];
		userPreferences?: any[];
	};
}

/**
 * Convert ISO date strings back to Date objects for Drizzle ORM
 * Drizzle with mode: 'timestamp' expects Date objects, not strings
 */
function convertDatesToObjects(data: any[]): any[] {
	return data.map((item) => {
		const converted = { ...item };
		for (const key in converted) {
			// Check if value is an ISO date string
			if (
				typeof converted[key] === 'string' &&
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(converted[key])
			) {
				converted[key] = new Date(converted[key]);
			}
		}
		return converted;
	});
}

export const load: PageServerLoad = async () => {
	const categoriesData = getAllCategories();
	const assetTagsData = getAllAssetTags();
	const paymentMethodsData = getAllPaymentMethods();

	return {
		categories: categoriesData,
		assetTags: assetTagsData,
		paymentMethods: paymentMethodsData
	};
};

export const actions: Actions = {
	importData: async ({ request }) => {
		try {
			console.log('Import request received');
			const formData = await request.formData();
			const file = formData.get('file') as File;

			if (!file) {
				console.log('No file in form data');
				return fail(400, { error: 'No file provided' });
			}

			console.log('File received:', file.name, file.size);

			// Read and parse the JSON file
			const content = await file.text();
			console.log('File content length:', content.length);
			let importData: ImportData;

			try {
				importData = JSON.parse(content);
				console.log('JSON parsed successfully');
			} catch (error) {
				console.error('JSON parse error:', error);
				return fail(400, { error: 'Invalid JSON file' });
			}

			// Validate the data structure
			if (!importData.version || !importData.data) {
				return fail(400, { error: 'Invalid backup file format' });
			}

			// Clear existing data (in reverse order due to foreign key constraints)
			db.delete(billPayments).run();
			db.delete(billCycles).run();
			db.delete(bills).run();
			db.delete(paymentMethods).run();
			db.delete(assetTags).run();
			db.delete(categories).run();
			db.delete(userPreferences).run();

			let importedCounts = {
				categories: 0,
				assetTags: 0,
				bills: 0,
				billCycles: 0,
				billPayments: 0,
				paymentMethods: 0,
				userPreferences: 0
			};

			// Import data (in order to respect foreign key constraints)
			if (importData.data.categories?.length > 0) {
				const convertedCategories = convertDatesToObjects(importData.data.categories);
				db.insert(categories).values(convertedCategories).run();
				importedCounts.categories = importData.data.categories.length;
			}

			if (importData.data.assetTags?.length > 0) {
				const convertedAssetTags = convertDatesToObjects(importData.data.assetTags);
				db.insert(assetTags).values(convertedAssetTags).run();
				importedCounts.assetTags = importData.data.assetTags.length;
			}

			if (importData.data.paymentMethods?.length > 0) {
				db.insert(paymentMethods).values(importData.data.paymentMethods).run();
				importedCounts.paymentMethods = importData.data.paymentMethods.length;
			}

			if (importData.data.bills?.length > 0) {
				const convertedBills = convertDatesToObjects(importData.data.bills);
				db.insert(bills).values(convertedBills).run();
				importedCounts.bills = importData.data.bills.length;
			}

			if (importData.data.billCycles?.length > 0) {
				const convertedBillCycles = convertDatesToObjects(importData.data.billCycles);
				db.insert(billCycles).values(convertedBillCycles).run();
				importedCounts.billCycles = importData.data.billCycles.length;
			}

			if (importData.data.billPayments?.length > 0) {
				const convertedBillPayments = convertDatesToObjects(importData.data.billPayments);
				db.insert(billPayments).values(convertedBillPayments).run();
				importedCounts.billPayments = importData.data.billPayments.length;
			}

			if (importData.data.userPreferences?.length > 0) {
				const convertedPrefs = convertDatesToObjects(importData.data.userPreferences);
				db.insert(userPreferences).values(convertedPrefs).run();
				importedCounts.userPreferences = importData.data.userPreferences.length;
			}

			console.log('Import successful:', importedCounts);

			return {
				success: true,
				message: 'Data imported successfully',
				imported: importedCounts
			};
		} catch (error) {
			console.error('Import error:', error);
			return fail(500, {
				error: `Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	},

	resetData: async ({ request }) => {
		try {
			const formData = await request.formData();
			const confirmation = formData.get('confirmation');

			// Require explicit confirmation
			if (confirmation !== 'DELETE ALL DATA') {
				return fail(400, { error: 'Invalid confirmation. Please type "DELETE ALL DATA" exactly.' });
			}

			// Delete all data (in reverse order due to foreign key constraints)
			db.delete(billPayments).run();
			db.delete(billCycles).run();
			db.delete(bills).run();
			db.delete(paymentMethods).run();
			db.delete(assetTags).run();
			db.delete(categories).run();
			db.delete(userPreferences).run();

			// Reset SQLite autoincrement sequences to start fresh
			db.run('DELETE FROM sqlite_sequence');

			console.log('All data has been reset');

			return {
				success: true,
				message: 'All data has been deleted successfully'
			};
		} catch (error) {
			console.error('Reset error:', error);
			return fail(500, {
				error: `Failed to reset data: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}
};
