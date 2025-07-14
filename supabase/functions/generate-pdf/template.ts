// supabase/functions/generate-pdf/template.ts

export const templateHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Meal Plan</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        body {
            font-family: 'Inter', sans-serif;
            color: #26211B;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #FCFCFC;
        }
        .page {
            padding: 40px;
        }
        .container {
            max-width: 800px;
            margin: auto;
            background: white;
        }
        .header {
            padding: 20px;
            text-align: center;
            border-bottom: 2px solid #F0EBE8;
        }
        .header h1 {
            color: #DD604A;
            font-size: 28px;
            font-weight: 700;
            margin: 0;
        }
        .meal-card {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #F0EBE8;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(221, 96, 74, 0.1);
            /* This is the key change to ensure each meal starts on a new page */
            page-break-before: always;
        }
        .meal-card-header {
            border-bottom: 1px solid #F0EBE8;
            padding-bottom: 15px;
            margin-bottom: 15px;
        }
        .meal-card-header h1 {
            font-size: 24px;
            color: #DD604A;
            font-weight: 700;
            margin: 0;
        }
        .meal-card h3 {
            font-size: 18px;
            font-weight: 600;
            color: #3B8C6E;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .shopping-list-section {
            /* This ensures the shopping list also gets its own page */
            page-break-before: always;
        }
        .shopping-list-section h2, .shopping-list-section h1 {
            font-size: 24px;
            color: #DD604A;
            font-weight: 700;
            border-bottom: 1px solid #F0EBE8;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        ul, ol {
            padding-left: 20px;
        }
        li {
            margin-bottom: 8px;
            color: #594D46;
        }
        ol li {
            padding-left: 5px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #F0EBE8;
            font-size: 12px;
            color: #7A6C65;
        }
        /* This prevents a blank page from appearing before the first element */
        .container > .meal-card:first-child,
        .container > .shopping-list-section:first-child {
            page-break-before: auto;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <h1>🍽️ Curate My Plate</h1>
        </div>

        <div class="container">
            {{MEAL_CARDS}}

            <div class="shopping-list-section">
                {{SHOPPING_LIST}}
            </div>
        </div>

        <div class="footer">
            <p>Your personalized meal plan, generated with love.</p>
        </div>
    </div>
</body>
</html>
`;