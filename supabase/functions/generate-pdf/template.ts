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
            color: #333;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            background-color: #FCFCFC;
        }
        .container {
            max-width: 800px;
            margin: auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
        }
        h1, h2, h3 {
            color: #4A5D23; /* Your brand's primary green */
            font-weight: 700;
        }
        h1 {
            font-size: 28px;
            border-bottom: 2px solid #EAEAEA;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        h2 {
            font-size: 22px;
            border-bottom: 1px solid #EAEAEA;
            padding-bottom: 8px;
            margin-top: 30px;
        }
        h3 {
            font-size: 18px;
            font-weight: 600;
            margin-top: 25px;
        }
        ul, ol {
            padding-left: 20px;
        }
        li {
            margin-bottom: 8px;
        }
        .meal-card {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }
        .shopping-list-section h2 {
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        {{MEAL_CARDS}}

        <div class="shopping-list-section">
            {{SHOPPING_LIST}}
        </div>
    </div>
</body>
</html>
`;