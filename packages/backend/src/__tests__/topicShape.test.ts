import { topicTitle, normaliseTopic } from '../utils/topicShape';

describe('topicShape', () => {
  it('reads a topic stored as a plain string', () => {
    // How Step 4 stores topics. The export read `topic.title` and printed all 79 of the
    // Logistics topics as "Untitled topic".
    expect(topicTitle('Kerala supply chain landscape and Kochi port overview')).toBe(
      'Kerala supply chain landscape and Kochi port overview'
    );
  });

  it('reads a topic stored as an object', () => {
    expect(topicTitle({ title: 'SCOR processes', hours: 2 })).toBe('SCOR processes');
    expect(topicTitle({ name: 'Warehousing' })).toBe('Warehousing');
  });

  it('returns an empty title only when there is genuinely no name', () => {
    expect(topicTitle({ hours: 2 })).toBe('');
    expect(topicTitle(null)).toBe('');
    expect(topicTitle('   ')).toBe('');
  });

  it('normalises either shape to one object with a sequence', () => {
    expect(normaliseTopic('Port operations', 2)).toEqual({ title: 'Port operations', sequence: 3 });
    expect(normaliseTopic({ id: 't1', title: 'Customs', hours: 1.5, sequence: 7 }, 0)).toEqual({
      id: 't1',
      title: 'Customs',
      hours: 1.5,
      sequence: 7,
    });
  });
});
