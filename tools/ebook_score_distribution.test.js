const {test}=require('node:test');
const assert=require('node:assert/strict');
const {forDisplay}=require('../ebook_score_distribution');

function same(score, count=1, studentScore=score) {
    return {score:studentScore,distMin:score,distMax:score,total:count,dist:[count,0,0,0,0],labels:['old'],myBucket:0};
}
for(const score of [100,107,150,200,100.5]) {
    test(`single ${score}: zero to actual maximum, last bucket`,()=>{
        const grade=same(score), before=JSON.stringify(grade), result=forDisplay(grade);
        assert.equal(result.normalized,true);
        assert.deepEqual(result.dist,[0,0,0,0,1]);
        assert.equal(result.myBucket,4);
        assert.ok(result.labels[0].startsWith('0 ~ '));
        assert.ok(result.labels[4].endsWith(' ~ '+score));
        assert.equal(JSON.stringify(grade),before);
    });
}
test('multiple equal scores preserve all counts',()=>{
    const result=forDisplay(same(107,9));
    assert.deepEqual(result.dist,[0,0,0,0,9]);
    assert.deepEqual(result.labels,['0 ~ 21','21 ~ 43','43 ~ 64','64 ~ 86','86 ~ 107']);
});
test('missing or unreviewed score does not highlight another student group',()=>{
    for(const score of ['',null,'待回報','缺考'])assert.equal(forDisplay(same(107,1,score)).myBucket,-1);
    assert.equal(forDisplay({...same(107),isMissing:true}).myBucket,-1);
    assert.equal(forDisplay(same(107,1,'107假')).myBucket,4);
});
test('ordinary 60–100 range remains unchanged when actual maximum is 80',()=>{
    const grade={score:80,distMin:60,distMax:80,total:2,dist:[1,0,1,0,0],labels:['60 ~ 68','68 ~ 76','76 ~ 84','84 ~ 92','92 ~ 100'],myBucket:2};
    assert.deepEqual(forDisplay(grade),{dist:grade.dist,labels:grade.labels,myBucket:2,normalized:false});
});
test('second different score restores original dynamic range and bucket',()=>{
    const grade={score:107,distMin:87,distMax:107,total:2,dist:[1,0,0,0,1],labels:['87 ~ 91','91 ~ 95','95 ~ 99','99 ~ 103','103 ~ 107'],myBucket:4};
    assert.deepEqual(forDisplay(grade),{dist:grade.dist,labels:grade.labels,myBucket:4,normalized:false});
    assert.equal(forDisplay(same(107)).normalized,true);
    assert.equal(forDisplay(grade).normalized,false);
});
test('below 100, zero, incomplete or conflicting metadata keeps existing behavior',()=>{
    for(const grade of [same(98),same(0),same(107,0),{...same(107),distMin:undefined},{...same(107),distMax:null},{...same(107),total:2},{...same(107),dist:[-1,0,0,0,2]},{...same(107),distMin:Infinity,distMax:Infinity}])assert.equal(forDisplay(grade).normalized,false);
});
test('both renderers consume normalized distribution and personal bucket',()=>{
    const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
    assert.match(html,/EbookScoreDistribution\.forDisplay\(exam\)/);
    assert.match(html,/EbookScoreDistribution\.forDisplay\(item\)/);
    assert.match(html,/chartDistribution\.normalized \|\|/);
    assert.equal((html.match(/idx === chartDistribution\.myBucket/g)||[]).length,2);
});
