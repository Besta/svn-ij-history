import { expect } from 'chai';
import { SvnService } from '../utils/SvnService';
import { XMLParser } from 'fast-xml-parser';

describe('SvnService Parsing', () => {
    let svnService: SvnService;

    beforeEach(() => {
        svnService = new SvnService('/fake/path');
    });

    it('should parse SVN log XML correctly', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <log>
        <logentry revision="1234">
        <author>testuser</author>
        <date>2023-10-27T10:00:00.000000Z</date>
        <paths>
        <path action="M" prop-mods="false" text-mods="true">/trunk/src/file.ts</path>
        </paths>
        <msg>test message</msg>
        </logentry>
        </log>`;

        // Access private method for testing parsing logic
        const commits = (svnService as any).parseXml(xml);

        expect(commits).to.have.lengthOf(1);
        expect(commits[0].rev).to.equal('1234');
        expect(commits[0].author).to.equal('testuser');
        expect(commits[0].msg).to.equal('test message');
        expect(commits[0].files).to.have.lengthOf(1);
        expect(commits[0].files[0].action).to.equal('M');
        expect(commits[0].files[0].path).to.equal('/trunk/src/file.ts');
    });

    it('should handle empty log XML', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?><log></log>`;
        const commits = (svnService as any).parseXml(xml);
        expect(commits).to.be.an('array').that.is.empty;
    });

    it('should parse SVN annotate XML correctly', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <blame>
        <target path="file.ts">
        <entry line-number="1">
        <commit revision="100">
        <author>dev1</author>
        <date>2023-10-26T12:00:00.000000Z</date>
        </commit>
        </entry>
        </target>
        </blame>`;

        const lines = (svnService as any).parseAnnotateXml(xml);

        expect(lines).to.have.lengthOf(1);
        expect(lines[0].line).to.equal(1);
        expect(lines[0].rev).to.equal('100');
        expect(lines[0].author).to.equal('dev1');
    });
});
