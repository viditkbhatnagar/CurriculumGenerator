import { isAutoMarked } from '../services/assessmentKind';

describe('isAutoMarked', () => {
  it.each(['MCQ knowledge checks', 'Short quizzes', 'multiple-choice test', 'mcq'])(
    'treats %s as auto-marked',
    (type) => expect(isAutoMarked(type)).toBe(true)
  );
  it.each(['Mini-case exercises', 'Practice simulations', 'Portfolio', '', undefined])(
    'treats %s as marked by a person',
    (type) => expect(isAutoMarked(type)).toBe(false)
  );
});
