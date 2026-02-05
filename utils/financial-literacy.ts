import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number; // index of correct option
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  duration_minutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  order: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  total_lessons: number;
  total_duration_minutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  lessons: Lesson[];
  quiz: QuizQuestion[];
  certificate_template: string;
}

export interface UserProgress {
  course_id: string;
  completed_lessons: string[];
  quiz_score?: number;
  quiz_attempts: number;
  started_at: number;
  completed_at?: number;
  certificate_earned: boolean;
}

export interface Certificate {
  id: string;
  course_id: string;
  course_title: string;
  user_name: string;
  completion_date: number;
  score: number;
}

const COURSES_STORAGE_KEY = "financial_literacy_courses";
const PROGRESS_STORAGE_KEY = "course_progress";
const CERTIFICATES_STORAGE_KEY = "certificates";

// Default courses
const DEFAULT_COURSES: Course[] = [
  {
    id: "course_budgeting",
    title: "Budgeting Fundamentals",
    description: "Learn how to create and stick to a budget that works for you",
    icon: "📊",
    category: "Personal Finance",
    total_lessons: 5,
    total_duration_minutes: 45,
    difficulty: "beginner",
    lessons: [
      {
        id: "lesson_1",
        title: "Why Budgeting Matters",
        description: "Understanding the importance of budgeting",
        content: `# Why Budgeting Matters

Budgeting is the foundation of financial success. It helps you:

## Benefits of Budgeting
- **Control Your Money**: Know exactly where your money goes
- **Achieve Goals**: Save for things that matter to you
- **Reduce Stress**: No more worrying about unexpected expenses
- **Build Wealth**: Consistent budgeting leads to financial growth

## Common Budgeting Myths
1. "Budgeting is restrictive" - Actually, it gives you freedom to spend guilt-free
2. "I don't earn enough to budget" - Budgeting is even more important with limited income
3. "It takes too much time" - Modern tools make it quick and easy

## Getting Started
The key is to start simple. Track your income and expenses for one month to understand your spending patterns.`,
        duration_minutes: 8,
        difficulty: "beginner",
        order: 1,
      },
      {
        id: "lesson_2",
        title: "The 50/30/20 Rule",
        description: "A simple budgeting framework",
        content: `# The 50/30/20 Rule

This simple rule helps you allocate your income effectively:

## The Breakdown
- **50% Needs**: Essential expenses (rent, food, utilities, transport)
- **30% Wants**: Non-essential spending (entertainment, dining out, hobbies)
- **20% Savings**: Emergency fund, investments, debt repayment

## Example
If you earn $2,000/month:
- $1,000 for needs
- $600 for wants
- $400 for savings

## Adjusting the Rule
You can modify the percentages based on your situation:
- High rent area? Try 60/20/20
- Aggressive saver? Try 50/20/30
- Paying off debt? Try 50/25/25

## Implementation Tips
1. Calculate your after-tax income
2. List all expenses by category
3. Adjust spending to match the rule
4. Review and refine monthly`,
        duration_minutes: 10,
        difficulty: "beginner",
        order: 2,
      },
      {
        id: "lesson_3",
        title: "Tracking Your Expenses",
        description: "Methods and tools for expense tracking",
        content: `# Tracking Your Expenses

You can't manage what you don't measure. Here's how to track effectively:

## Manual Tracking
- **Notebook Method**: Write down every expense
- **Spreadsheet**: Use Excel or Google Sheets
- **Pros**: Full control, no privacy concerns
- **Cons**: Time-consuming, easy to forget

## Digital Tools
- **Banking Apps**: Automatic categorization
- **Budgeting Apps**: Real-time tracking and insights
- **Pros**: Automatic, visual reports
- **Cons**: Requires linking accounts

## Best Practices
1. **Track Everything**: Even small purchases add up
2. **Categorize Consistently**: Use the same categories each month
3. **Review Weekly**: Catch overspending early
4. **Be Honest**: Don't hide or justify unnecessary expenses

## Common Categories
- Housing (rent, mortgage, utilities)
- Transportation (car, fuel, public transport)
- Food (groceries, dining out)
- Healthcare
- Entertainment
- Savings & Investments`,
        duration_minutes: 9,
        difficulty: "beginner",
        order: 3,
      },
      {
        id: "lesson_4",
        title: "Creating Your First Budget",
        description: "Step-by-step budget creation",
        content: `# Creating Your First Budget

Follow these steps to create a realistic budget:

## Step 1: Calculate Income
List all sources of income:
- Salary (after tax)
- Side hustles
- Passive income
- Other regular income

## Step 2: List Fixed Expenses
These don't change month-to-month:
- Rent/Mortgage
- Insurance
- Loan payments
- Subscriptions

## Step 3: Estimate Variable Expenses
These fluctuate but are necessary:
- Groceries
- Utilities
- Transportation
- Phone/Internet

## Step 4: Plan Discretionary Spending
Fun money that's flexible:
- Entertainment
- Dining out
- Hobbies
- Shopping

## Step 5: Set Savings Goals
Pay yourself first:
- Emergency fund
- Retirement
- Specific goals (vacation, car, etc.)

## Step 6: Review and Adjust
- Does income cover all expenses?
- Is there room for savings?
- What can be reduced?

## Budget Template
Income: $______
Fixed: $______
Variable: $______
Discretionary: $______
Savings: $______
Remaining: $______`,
        duration_minutes: 12,
        difficulty: "beginner",
        order: 4,
      },
      {
        id: "lesson_5",
        title: "Sticking to Your Budget",
        description: "Tips for long-term success",
        content: `# Sticking to Your Budget

Creating a budget is easy. Sticking to it is the challenge. Here's how:

## Mindset Shifts
- **Budget = Freedom**: It's not restrictive, it's empowering
- **Progress Over Perfection**: Some months will be better than others
- **Delayed Gratification**: Short-term sacrifice for long-term gain

## Practical Strategies
1. **Use Cash Envelopes**: Physical cash for discretionary categories
2. **Automate Savings**: Transfer to savings before you can spend it
3. **Wait 24 Hours**: For non-essential purchases over $50
4. **Find Free Alternatives**: Library books, free events, home workouts
5. **Meal Plan**: Reduces food waste and impulse purchases

## Dealing with Setbacks
- **Don't Give Up**: One bad month doesn't mean failure
- **Analyze What Happened**: Was it unexpected or poor planning?
- **Adjust if Needed**: Your budget should evolve with your life
- **Celebrate Wins**: Acknowledge when you stay on track

## Monthly Review Process
1. Compare actual vs budgeted spending
2. Identify problem areas
3. Adjust next month's budget
4. Set one improvement goal

## Warning Signs
- Consistently overspending in multiple categories
- Using credit cards to cover basics
- No emergency fund after 6+ months
- Feeling stressed about money despite having income

## Success Metrics
- 3+ months of consistent tracking
- Emergency fund growing
- Debt decreasing
- Savings goals being met
- Reduced financial stress`,
        duration_minutes: 6,
        difficulty: "beginner",
        order: 5,
      },
    ],
    quiz: [
      {
        id: "q1",
        question: "According to the 50/30/20 rule, what percentage should go to needs?",
        options: ["30%", "50%", "20%", "40%"],
        correct_answer: 1,
        explanation: "The 50/30/20 rule allocates 50% to needs, 30% to wants, and 20% to savings.",
      },
      {
        id: "q2",
        question: "Which is NOT a benefit of budgeting?",
        options: [
          "Control over your money",
          "Achieving financial goals",
          "Guaranteed wealth",
          "Reduced financial stress",
        ],
        correct_answer: 2,
        explanation: "Budgeting helps with control, goals, and stress, but doesn't guarantee wealth.",
      },
      {
        id: "q3",
        question: "What should you do first when creating a budget?",
        options: [
          "List discretionary spending",
          "Calculate total income",
          "Set savings goals",
          "Cut all expenses",
        ],
        correct_answer: 1,
        explanation: "You need to know your income before you can allocate it to different categories.",
      },
      {
        id: "q4",
        question: "How often should you review your budget?",
        options: ["Yearly", "Monthly", "Never", "Only when problems arise"],
        correct_answer: 1,
        explanation: "Monthly reviews help you stay on track and make necessary adjustments.",
      },
      {
        id: "q5",
        question: "What is the 'pay yourself first' principle?",
        options: [
          "Spend on wants before needs",
          "Transfer to savings before spending",
          "Pay bills late to save money",
          "Only save what's left over",
        ],
        correct_answer: 1,
        explanation: "'Pay yourself first' means prioritizing savings by transferring money to savings before spending on other things.",
      },
    ],
    certificate_template: "budgeting_fundamentals",
  },
  {
    id: "course_investing",
    title: "Investing Basics",
    description: "Introduction to investing and building wealth",
    icon: "📈",
    category: "Investing",
    total_lessons: 4,
    total_duration_minutes: 40,
    difficulty: "intermediate",
    lessons: [
      {
        id: "lesson_1",
        title: "Why Invest?",
        description: "Understanding the power of investing",
        content: `# Why Invest?

Investing is how you make your money work for you.

## The Power of Compound Interest
Albert Einstein called it "the eighth wonder of the world." Here's why:

**Example**: $1,000 invested at 8% annual return
- Year 1: $1,080
- Year 10: $2,159
- Year 20: $4,661
- Year 30: $10,063

## Inflation Protection
- Cash loses value over time due to inflation
- Investing helps your money grow faster than inflation
- Preserves and increases purchasing power

## Building Wealth
- Passive income through dividends and interest
- Capital appreciation over time
- Financial independence and early retirement

## Starting Early Matters
Starting at age 25 vs 35 (assuming 8% return):
- Age 25: Invest $200/month → $700,000 at 65
- Age 35: Invest $200/month → $300,000 at 65

The 10-year head start more than doubles the result!`,
        duration_minutes: 10,
        difficulty: "intermediate",
        order: 1,
      },
      {
        id: "lesson_2",
        title: "Types of Investments",
        description: "Stocks, bonds, and more",
        content: `# Types of Investments

Understanding different investment vehicles:

## Stocks (Equities)
- Ownership in a company
- Higher risk, higher potential return
- Dividends + capital gains
- Best for long-term growth

## Bonds (Fixed Income)
- Lending money to government/corporations
- Lower risk, lower return
- Regular interest payments
- Good for stability

## Mutual Funds
- Pool of money from many investors
- Professional management
- Diversification
- Higher fees

## ETFs (Exchange-Traded Funds)
- Like mutual funds but trade like stocks
- Lower fees
- Easy diversification
- Flexible trading

## Real Estate
- Physical property or REITs
- Rental income + appreciation
- Requires more capital
- Less liquid

## Commodities
- Gold, oil, agricultural products
- Inflation hedge
- High volatility
- Requires expertise`,
        duration_minutes: 12,
        difficulty: "intermediate",
        order: 2,
      },
      {
        id: "lesson_3",
        title: "Risk and Diversification",
        description: "Managing investment risk",
        content: `# Risk and Diversification

"Don't put all your eggs in one basket"

## Understanding Risk
- **Market Risk**: Overall market declines
- **Company Risk**: Specific company fails
- **Inflation Risk**: Returns don't beat inflation
- **Liquidity Risk**: Can't sell when needed

## Risk Tolerance
Depends on:
- Age (younger = more risk tolerance)
- Financial goals
- Income stability
- Personality

## Diversification Strategies
1. **Across Asset Classes**: Stocks, bonds, real estate
2. **Geographic**: Domestic and international
3. **Sectors**: Tech, healthcare, finance, etc.
4. **Company Size**: Large-cap, mid-cap, small-cap

## Asset Allocation
Example for 30-year-old:
- 70% Stocks (growth)
- 20% Bonds (stability)
- 10% Cash/Alternatives

Adjust as you age (more conservative)

## Rebalancing
- Review portfolio quarterly
- Sell winners, buy losers
- Maintain target allocation
- Reduces risk automatically`,
        duration_minutes: 10,
        difficulty: "intermediate",
        order: 3,
      },
      {
        id: "lesson_4",
        title: "Getting Started",
        description: "Your first investment steps",
        content: `# Getting Started with Investing

Ready to begin? Follow these steps:

## Step 1: Build Emergency Fund
Before investing:
- 3-6 months of expenses
- In a savings account
- For unexpected costs

## Step 2: Pay Off High-Interest Debt
- Credit cards (15%+ interest)
- Personal loans
- Investing returns unlikely to beat high interest

## Step 3: Choose an Account
- **Brokerage Account**: Flexible, taxable
- **Retirement Account**: Tax advantages, restrictions
- **Robo-Advisor**: Automated, low fees

## Step 4: Start Small
- Begin with what you can afford
- Even $50/month makes a difference
- Consistency matters more than amount

## Step 5: Invest Regularly
- Dollar-cost averaging
- Reduces timing risk
- Builds discipline
- Automate if possible

## Step 6: Stay the Course
- Don't panic sell in downturns
- Think long-term (10+ years)
- Ignore daily fluctuations
- Review annually, not daily

## Common Beginner Mistakes
- Trying to time the market
- Chasing hot stocks
- Panic selling
- Not diversifying
- Paying high fees

## Resources
- Investment apps
- Online brokers
- Financial advisors
- Educational websites`,
        duration_minutes: 8,
        difficulty: "intermediate",
        order: 4,
      },
    ],
    quiz: [
      {
        id: "q1",
        question: "What is compound interest?",
        options: [
          "Interest paid once",
          "Interest on interest",
          "Simple interest",
          "No interest",
        ],
        correct_answer: 1,
        explanation: "Compound interest is earning interest on both your principal and previously earned interest.",
      },
      {
        id: "q2",
        question: "Which investment typically has the highest risk?",
        options: ["Bonds", "Savings account", "Stocks", "CDs"],
        correct_answer: 2,
        explanation: "Stocks generally have higher risk but also higher potential returns compared to bonds and savings.",
      },
      {
        id: "q3",
        question: "What does diversification mean?",
        options: [
          "Buying only one stock",
          "Spreading investments across different assets",
          "Investing everything in bonds",
          "Keeping all money in cash",
        ],
        correct_answer: 1,
        explanation: "Diversification means spreading your investments across different assets to reduce risk.",
      },
      {
        id: "q4",
        question: "What should you do BEFORE investing?",
        options: [
          "Buy expensive stocks",
          "Build an emergency fund",
          "Quit your job",
          "Take out loans",
        ],
        correct_answer: 1,
        explanation: "You should have an emergency fund (3-6 months expenses) before investing.",
      },
    ],
    certificate_template: "investing_basics",
  },
  {
    id: "course_debt",
    title: "Debt Management",
    description: "Strategies to eliminate debt and stay debt-free",
    icon: "💳",
    category: "Debt",
    total_lessons: 4,
    total_duration_minutes: 35,
    difficulty: "beginner",
    lessons: [
      {
        id: "lesson_1",
        title: "Understanding Debt",
        description: "Good debt vs bad debt",
        content: `# Understanding Debt

Not all debt is created equal.

## Good Debt
Investments that increase your net worth:
- **Student Loans**: Increases earning potential
- **Mortgage**: Builds home equity
- **Business Loans**: Grows income-generating business

Characteristics:
- Low interest rate
- Tax deductible
- Appreciating asset
- Improves financial position

## Bad Debt
Consumption that decreases net worth:
- **Credit Cards**: High interest on depreciating items
- **Payday Loans**: Extremely high interest
- **Auto Loans**: Depreciating asset
- **Personal Loans**: For non-essential spending

Characteristics:
- High interest rate
- Non-deductible
- Depreciating asset
- Hurts financial position

## The Debt Trap
How it happens:
1. Use credit for wants
2. Pay minimum payment
3. Interest accumulates
4. Balance grows
5. Stress increases

## Warning Signs
- Paying only minimums
- Using new credit to pay old debt
- Hiding purchases from family
- Losing sleep over money
- Avoiding bills`,
        duration_minutes: 9,
        difficulty: "beginner",
        order: 1,
      },
      {
        id: "lesson_2",
        title: "Debt Payoff Strategies",
        description: "Snowball vs Avalanche methods",
        content: `# Debt Payoff Strategies

Two proven methods to eliminate debt:

## Snowball Method
Pay off smallest debt first:
1. List debts smallest to largest
2. Pay minimums on all
3. Extra money to smallest
4. When paid, move to next

**Pros**: Quick wins, motivation
**Cons**: May pay more interest

## Avalanche Method
Pay off highest interest first:
1. List debts by interest rate
2. Pay minimums on all
3. Extra money to highest rate
4. When paid, move to next

**Pros**: Saves most money
**Cons**: Slower initial progress

## Which to Choose?
- **Snowball**: Need motivation, small debts
- **Avalanche**: Disciplined, large interest differences

## Debt Consolidation
Combine multiple debts into one:
- Lower interest rate
- Single payment
- Simplified tracking

**Warning**: Don't accumulate new debt!

## Balance Transfer
Move credit card debt to 0% card:
- 12-18 months interest-free
- Pay off during promo period
- Watch for transfer fees

## Negotiation
Call creditors to:
- Lower interest rate
- Waive fees
- Set up payment plan
- Settle for less (last resort)`,
        duration_minutes: 10,
        difficulty: "beginner",
        order: 2,
      },
      {
        id: "lesson_3",
        title: "Creating a Payoff Plan",
        description: "Your personalized debt elimination strategy",
        content: `# Creating Your Payoff Plan

Step-by-step debt elimination:

## Step 1: List All Debts
For each debt, record:
- Creditor name
- Total balance
- Interest rate
- Minimum payment
- Due date

## Step 2: Calculate Debt-Free Date
Use online calculator or:
- Total debt ÷ monthly payment
- Adjust for interest
- Set realistic timeline

## Step 3: Find Extra Money
Review budget for:
- Unnecessary subscriptions
- Dining out reduction
- Entertainment cuts
- Side hustle income

## Step 4: Automate Payments
- Set up auto-pay
- Never miss due date
- Avoid late fees
- Protect credit score

## Step 5: Track Progress
- Update spreadsheet monthly
- Celebrate milestones
- Visualize progress
- Stay motivated

## Step 6: Prevent New Debt
- Use cash/debit only
- Remove saved cards online
- Freeze credit cards (literally!)
- Address emotional spending

## Sample Plan
**Total Debt**: $15,000
**Monthly Payment**: $500
**Timeline**: 36 months

Month 1-12: Pay off credit cards
Month 13-24: Pay off personal loan
Month 25-36: Pay off car loan

## Motivation Tips
- Visual debt thermometer
- Celebrate $1,000 milestones
- Share goals with accountability partner
- Reward yourself (free/cheap)`,
        duration_minutes: 10,
        difficulty: "beginner",
        order: 3,
      },
      {
        id: "lesson_4",
        title: "Staying Debt-Free",
        description: "Building habits for long-term success",
        content: `# Staying Debt-Free

Eliminating debt is hard. Staying debt-free requires new habits:

## Mindset Changes
- **Delayed Gratification**: Save first, buy later
- **Needs vs Wants**: Question every purchase
- **Cash Mindset**: If you can't afford cash, don't buy
- **Contentment**: Happiness isn't in things

## Practical Habits
1. **Emergency Fund**: 3-6 months expenses
2. **Sinking Funds**: Save for known expenses
3. **30-Day Rule**: Wait before large purchases
4. **Cash Envelopes**: Physical spending limits
5. **No-Spend Challenges**: Monthly or weekly

## Credit Card Rules
If you use credit cards:
- Pay in full monthly
- Never carry balance
- Use for rewards only
- Track every purchase

## Dealing with Temptation
- Unsubscribe from marketing emails
- Avoid malls/online shopping
- Find free entertainment
- Focus on experiences, not things

## When Life Happens
Unexpected expenses will occur:
- Use emergency fund
- Adjust budget temporarily
- Don't panic
- Get back on track quickly

## Building Wealth
Once debt-free, redirect payments to:
- Fully-funded emergency fund (6+ months)
- Retirement investing
- Kids' education
- House down payment
- Wealth building

## Helping Others
- Share your story
- Encourage friends/family
- Be debt-free role model
- Break generational cycles`,
        duration_minutes: 6,
        difficulty: "beginner",
        order: 4,
      },
    ],
    quiz: [
      {
        id: "q1",
        question: "Which is an example of 'good debt'?",
        options: ["Credit card debt", "Mortgage", "Payday loan", "Shopping debt"],
        correct_answer: 1,
        explanation: "A mortgage is considered good debt because it builds equity in an appreciating asset.",
      },
      {
        id: "q2",
        question: "What is the snowball method?",
        options: [
          "Pay highest interest first",
          "Pay smallest debt first",
          "Pay random debts",
          "Don't pay any debt",
        ],
        correct_answer: 1,
        explanation: "The snowball method focuses on paying off the smallest debt first for quick wins and motivation.",
      },
      {
        id: "q3",
        question: "How much should you have in an emergency fund?",
        options: ["1 month", "3-6 months", "1 year", "No need for one"],
        correct_answer: 1,
        explanation: "Financial experts recommend 3-6 months of expenses in an emergency fund.",
      },
      {
        id: "q4",
        question: "What should you do AFTER paying off debt?",
        options: [
          "Take on more debt",
          "Build emergency fund and invest",
          "Stop budgeting",
          "Spend freely",
        ],
        correct_answer: 1,
        explanation: "After paying off debt, focus on building a fully-funded emergency fund and investing for the future.",
      },
    ],
    certificate_template: "debt_management",
  },
];

/**
 * Get all courses
 */
export async function getCourses(): Promise<Course[]> {
  try {
    const coursesJson = await AsyncStorage.getItem(COURSES_STORAGE_KEY);
    if (!coursesJson) {
      await AsyncStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(DEFAULT_COURSES));
      return DEFAULT_COURSES;
    }
    return JSON.parse(coursesJson);
  } catch (error) {
    console.error("Failed to get courses:", error);
    return DEFAULT_COURSES;
  }
}

/**
 * Get course by ID
 */
export async function getCourse(courseId: string): Promise<Course | null> {
  const courses = await getCourses();
  return courses.find((c) => c.id === courseId) || null;
}

/**
 * Get user progress for all courses
 */
export async function getAllProgress(): Promise<UserProgress[]> {
  try {
    const progressJson = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!progressJson) return [];
    return JSON.parse(progressJson);
  } catch (error) {
    console.error("Failed to get progress:", error);
    return [];
  }
}

/**
 * Get user progress for a course
 */
export async function getCourseProgress(courseId: string): Promise<UserProgress | null> {
  const allProgress = await getAllProgress();
  return allProgress.find((p) => p.course_id === courseId) || null;
}

/**
 * Start a course
 */
export async function startCourse(courseId: string): Promise<UserProgress> {
  const allProgress = await getAllProgress();
  
  let progress = allProgress.find((p) => p.course_id === courseId);
  
  if (!progress) {
    progress = {
      course_id: courseId,
      completed_lessons: [],
      quiz_attempts: 0,
      started_at: Date.now(),
      certificate_earned: false,
    };
    allProgress.push(progress);
    await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(allProgress));
  }
  
  return progress;
}

/**
 * Complete a lesson
 */
export async function completeLesson(courseId: string, lessonId: string): Promise<UserProgress> {
  const allProgress = await getAllProgress();
  let progress = allProgress.find((p) => p.course_id === courseId);
  
  if (!progress) {
    progress = await startCourse(courseId);
  }
  
  if (!progress.completed_lessons.includes(lessonId)) {
    progress.completed_lessons.push(lessonId);
    await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(allProgress));
  }
  
  return progress;
}

/**
 * Submit quiz
 */
export async function submitQuiz(
  courseId: string,
  answers: number[]
): Promise<{ score: number; passed: boolean; certificate?: Certificate }> {
  const course = await getCourse(courseId);
  if (!course) throw new Error("Course not found");
  
  // Calculate score
  let correct = 0;
  course.quiz.forEach((question, index) => {
    if (answers[index] === question.correct_answer) {
      correct++;
    }
  });
  
  const score = Math.round((correct / course.quiz.length) * 100);
  const passed = score >= 70; // 70% passing grade
  
  // Update progress
  const allProgress = await getAllProgress();
  let progress = allProgress.find((p) => p.course_id === courseId);
  
  if (!progress) {
    progress = await startCourse(courseId);
  }
  
  progress.quiz_attempts++;
  progress.quiz_score = score;
  
  let certificate: Certificate | undefined;
  
  if (passed && !progress.certificate_earned) {
    progress.completed_at = Date.now();
    progress.certificate_earned = true;
    
    // Generate certificate
    certificate = await generateCertificate(courseId, score);
  }
  
  await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(allProgress));
  
  return { score, passed, certificate };
}

/**
 * Generate certificate
 */
async function generateCertificate(courseId: string, score: number): Promise<Certificate> {
  const course = await getCourse(courseId);
  if (!course) throw new Error("Course not found");
  
  const certificate: Certificate = {
    id: `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    course_id: courseId,
    course_title: course.title,
    user_name: "John Doe", // In production, get from auth context
    completion_date: Date.now(),
    score,
  };
  
  // Save certificate
  const certificatesJson = await AsyncStorage.getItem(CERTIFICATES_STORAGE_KEY);
  const certificates: Certificate[] = certificatesJson ? JSON.parse(certificatesJson) : [];
  certificates.push(certificate);
  await AsyncStorage.setItem(CERTIFICATES_STORAGE_KEY, JSON.stringify(certificates));
  
  return certificate;
}

/**
 * Get user certificates
 */
export async function getCertificates(): Promise<Certificate[]> {
  try {
    const certificatesJson = await AsyncStorage.getItem(CERTIFICATES_STORAGE_KEY);
    if (!certificatesJson) return [];
    return JSON.parse(certificatesJson);
  } catch (error) {
    console.error("Failed to get certificates:", error);
    return [];
  }
}

/**
 * Get course completion percentage
 */
export function getCourseCompletionPercentage(course: Course, progress: UserProgress | null): number {
  if (!progress) return 0;
  
  const totalSteps = course.lessons.length + 1; // lessons + quiz
  const completedLessons = progress.completed_lessons.length;
  const quizCompleted = progress.certificate_earned ? 1 : 0;
  
  return Math.round(((completedLessons + quizCompleted) / totalSteps) * 100);
}

/**
 * Get recommended courses based on progress
 */
export async function getRecommendedCourses(): Promise<Course[]> {
  const courses = await getCourses();
  const allProgress = await getAllProgress();
  
  // Recommend courses not started or not completed
  return courses.filter((course) => {
    const progress = allProgress.find((p) => p.course_id === course.id);
    return !progress || !progress.certificate_earned;
  });
}

/**
 * Get learning statistics
 */
export async function getLearningStatistics(): Promise<{
  courses_started: number;
  courses_completed: number;
  total_lessons_completed: number;
  certificates_earned: number;
  total_learning_time: number;
}> {
  const allProgress = await getAllProgress();
  const certificates = await getCertificates();
  const courses = await getCourses();
  
  const coursesStarted = allProgress.length;
  const coursesCompleted = allProgress.filter((p) => p.certificate_earned).length;
  
  let totalLessonsCompleted = 0;
  let totalLearningTime = 0;
  
  for (const progress of allProgress) {
    totalLessonsCompleted += progress.completed_lessons.length;
    
    const course = courses.find((c) => c.id === progress.course_id);
    if (course) {
      for (const lessonId of progress.completed_lessons) {
        const lesson = course.lessons.find((l) => l.id === lessonId);
        if (lesson) {
          totalLearningTime += lesson.duration_minutes;
        }
      }
    }
  }
  
  return {
    courses_started: coursesStarted,
    courses_completed: coursesCompleted,
    total_lessons_completed: totalLessonsCompleted,
    certificates_earned: certificates.length,
    total_learning_time: totalLearningTime,
  };
}
